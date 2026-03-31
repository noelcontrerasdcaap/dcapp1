#!/usr/bin/env python3

import requests
import json

BASE_URL = "https://dcapp-sales-hub.preview.emergentagent.com/api"

# Get token
auth_response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "gerente.ventas.digital@dcapp.com",
    "password": "dcapp123"
})

if auth_response.status_code != 200:
    print(f"Auth failed: {auth_response.text}")
    exit(1)

token = auth_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print(f"✅ Authenticated successfully")

# Get DCAs for lead creation
dcas_response = requests.get(f"{BASE_URL}/users", headers=headers, params={"role": "DCA", "agency": "Meridien"})
if dcas_response.status_code != 200:
    print(f"Failed to get DCAs: {dcas_response.text}")
    exit(1)

dcas = dcas_response.json()
if not dcas:
    print("No DCAs found")
    exit(1)

dca_id = dcas[0]["id"]
print(f"✅ Found DCA: {dca_id}")

# Create campaign first
campaign_data = {
    "nombre": "Test Campaign Active",
    "agencia": "Meridien",
    "canal": "Facebook Ads",
    "proveedor": "Cronozz",
    "tipo_campana": "Ads / Facebook / Cronozz",
    "estado": "Activa"
}

campaign_response = requests.post(f"{BASE_URL}/campaigns", headers=headers, json=campaign_data)
if campaign_response.status_code != 200:
    print(f"Failed to create campaign: {campaign_response.text}")
    exit(1)

campaign_id = campaign_response.json()["id"]
print(f"✅ Created campaign: {campaign_id}")

# Test lead creation with campaign_id
lead_data = {
    "name": "Test Lead Con Campaña",
    "phone": "555-1234-CAMP",
    "agency": "Meridien",
    "origin": "Facebook",
    "campaign": "Test Campaign",
    "campaign_id": campaign_id,
    "dca_id": dca_id
}

print(f"Testing lead creation with data: {json.dumps(lead_data, indent=2)}")
lead_response = requests.post(f"{BASE_URL}/leads", headers=headers, json=lead_data)

print(f"Status Code: {lead_response.status_code}")
print(f"Response: {lead_response.text}")

if lead_response.status_code == 200:
    lead_data_response = lead_response.json()
    print(f"✅ Lead created successfully with campaign_id: {lead_data_response.get('campaign_id')}")
    
    # Verify the lead
    lead_id = lead_data_response["id"]
    verify_response = requests.get(f"{BASE_URL}/leads/{lead_id}", headers=headers)
    if verify_response.status_code == 200:
        verified_lead = verify_response.json()
        print(f"✅ Lead verification: campaign_id = {verified_lead.get('campaign_id')}")
    else:
        print(f"❌ Lead verification failed: {verify_response.text}")
else:
    print(f"❌ Lead creation failed: {lead_response.text}")

# Cleanup - delete campaign
requests.delete(f"{BASE_URL}/campaigns/{campaign_id}", headers=headers)
print(f"✅ Cleaned up campaign")