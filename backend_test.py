#!/usr/bin/env python3
"""
DCAPP V1 - Campañas y Marketing Dashboard Testing
Test verification for the new modules according to review request

Review Request: "Verificar el nuevo módulo de Campañas y Marketing Dashboard de DCAPP"

CREDENCIALES:
- Gerente de Ventas Digitales: gerente.ventas.digital@dcapp.com / dcapp123
- Director: director@dcapp.com / dcapp123

Test Sequence:
1. Campañas - CRUD operations
2. Permisos de Campañas - Director role restrictions
3. Marketing Dashboard - Data and filters
4. Configuración - Campaign settings
"""

import requests
import json
import sys
from datetime import datetime, timedelta

BASE_URL = "https://dcapp-sales-hub.preview.emergentagent.com/api"

# Test credentials
GERENTE_VENTAS_DIGITAL = {
    "email": "gerente.ventas.digital@dcapp.com",
    "password": "dcapp123"
}

DIRECTOR = {
    "email": "director@dcapp.com", 
    "password": "dcapp123"
}

class TestRunner:
    def __init__(self):
        self.results = []
        self.tokens = {}
        
    def log_result(self, test_name, success, details="", expected="", actual=""):
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "expected": expected,
            "actual": actual,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and expected:
            print(f"   Expected: {expected}")
            print(f"   Actual: {actual}")
        print()
        
    def authenticate_user(self, credentials, role_name):
        """Authenticate user and store token"""
        try:
            response = requests.post(f"{BASE_URL}/auth/login", json=credentials)
            if response.status_code == 200:
                token_data = response.json()
                self.tokens[role_name] = token_data["access_token"]
                self.log_result(f"Authentication - {role_name}", True, f"Successfully authenticated {credentials['email']}")
                return True
            else:
                self.log_result(f"Authentication - {role_name}", False, f"Failed to authenticate: {response.text}")
                return False
        except Exception as e:
            self.log_result(f"Authentication - {role_name}", False, f"Exception during authentication: {str(e)}")
            return False
    
    def make_request(self, method, endpoint, token=None, json_data=None, params=None):
        """Make authenticated request"""
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        url = f"{BASE_URL}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=json_data)
            elif method.upper() == "PATCH":
                response = requests.patch(url, headers=headers, json=json_data)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            print(f"Request exception: {str(e)}")
            return None

    def test_campaigns_crud_gerente(self):
        """Test 1: Campañas - CRUD operations as Gerente de Ventas Digitales"""
        print("=== TEST 1: CAMPAÑAS - CRUD OPERATIONS (GERENTE DE VENTAS DIGITALES) ===\n")
        
        token = self.tokens.get("gerente")
        if not token:
            self.log_result("CRUD Setup", False, "No token for Gerente de Ventas Digitales")
            return
        
        # 1.1 GET /api/campaigns - Should return empty list or campaigns
        response = self.make_request("GET", "/campaigns", token)
        if response and response.status_code == 200:
            campaigns_data = response.json()
            self.log_result("GET /api/campaigns", True, f"Retrieved {len(campaigns_data)} campaigns")
        else:
            self.log_result("GET /api/campaigns", False, f"Status: {response.status_code if response else 'No response'}")
            return
        
        # 1.2 POST /api/campaigns - Create test campaign
        test_campaign = {
            "nombre": "Campaña Test Facebook",
            "agencia": "Meridien",
            "canal": "Facebook Ads", 
            "proveedor": "Cronozz",
            "tipo_campana": "Ads / Facebook / Cronozz",
            "estado": "Activa"
        }
        
        response = self.make_request("POST", "/campaigns", token, test_campaign)
        if response and response.status_code == 200:
            campaign_created = response.json()
            campaign_id = campaign_created["id"]
            self.log_result("POST /api/campaigns", True, f"Created campaign with ID: {campaign_id}")
            
            # Verify campaign data
            if (campaign_created["nombre"] == test_campaign["nombre"] and 
                campaign_created["agencia"] == test_campaign["agencia"] and
                campaign_created["estado"] == test_campaign["estado"]):
                self.log_result("Campaign Data Validation", True, "All fields match created campaign")
            else:
                self.log_result("Campaign Data Validation", False, "Campaign data doesn't match")
            
        else:
            self.log_result("POST /api/campaigns", False, 
                          f"Status: {response.status_code if response else 'No response'}, "
                          f"Response: {response.text if response else 'None'}")
            return
        
        # 1.3 GET /api/campaigns/{id} - Verify creation
        response = self.make_request("GET", f"/campaigns/{campaign_id}", token)
        if response and response.status_code == 200:
            campaign_detail = response.json()
            self.log_result("GET /api/campaigns/{id}", True, f"Retrieved campaign: {campaign_detail['nombre']}")
            
            # Verify all required fields are present
            required_fields = ["id", "nombre", "agencia", "canal", "proveedor", "tipo_campana", "estado", 
                             "dias_activos", "leads_generados", "leads_por_dia"]
            missing_fields = [f for f in required_fields if f not in campaign_detail]
            if not missing_fields:
                self.log_result("Campaign Structure Validation", True, "All required fields present")
            else:
                self.log_result("Campaign Structure Validation", False, f"Missing fields: {missing_fields}")
                
        else:
            self.log_result("GET /api/campaigns/{id}", False, f"Status: {response.status_code if response else 'No response'}")
            return
        
        # 1.4 PATCH /api/campaigns/{id} - Update campaign status
        update_data = {"estado": "Finalizada"}
        response = self.make_request("PATCH", f"/campaigns/{campaign_id}", token, update_data)
        if response and response.status_code == 200:
            updated_campaign = response.json()
            if updated_campaign["estado"] == "Finalizada":
                self.log_result("PATCH /api/campaigns/{id}", True, "Successfully updated campaign status to Finalizada")
            else:
                self.log_result("PATCH /api/campaigns/{id}", False, f"Status not updated. Current: {updated_campaign['estado']}")
        else:
            self.log_result("PATCH /api/campaigns/{id}", False, f"Status: {response.status_code if response else 'No response'}")
        
        # 1.5 DELETE /api/campaigns/{id} - Delete campaign
        response = self.make_request("DELETE", f"/campaigns/{campaign_id}", token)
        if response and response.status_code == 200:
            delete_response = response.json()
            self.log_result("DELETE /api/campaigns/{id}", True, f"Campaign deleted: {delete_response.get('message', 'Success')}")
            
            # Verify deletion
            response = self.make_request("GET", f"/campaigns/{campaign_id}", token)
            if response and response.status_code == 404:
                self.log_result("Deletion Verification", True, "Campaign no longer exists (404)")
            else:
                self.log_result("Deletion Verification", False, f"Campaign still exists: {response.status_code if response else 'No response'}")
        else:
            self.log_result("DELETE /api/campaigns/{id}", False, f"Status: {response.status_code if response else 'No response'}")

    def test_campaigns_permissions_director(self):
        """Test 2: Permisos de Campañas - Director restrictions"""
        print("=== TEST 2: PERMISOS DE CAMPAÑAS - DIRECTOR ===\n")
        
        director_token = self.tokens.get("director")
        gerente_token = self.tokens.get("gerente")
        
        if not director_token or not gerente_token:
            self.log_result("Permissions Setup", False, "Missing tokens for permission tests")
            return
        
        # First create a campaign as Gerente to test against
        test_campaign = {
            "nombre": "Test Permissions Campaign", 
            "agencia": "Meridien",
            "canal": "Facebook Ads",
            "proveedor": "Cronozz", 
            "tipo_campana": "Ads / Facebook / Cronozz",
            "estado": "Activa"
        }
        
        response = self.make_request("POST", "/campaigns", gerente_token, test_campaign)
        if response and response.status_code == 200:
            campaign_id = response.json()["id"]
            self.log_result("Test Campaign Creation", True, f"Created test campaign: {campaign_id}")
        else:
            self.log_result("Test Campaign Creation", False, "Could not create test campaign for permissions test")
            return
        
        # 2.1 GET /api/campaigns - Director should be able to view (200)
        response = self.make_request("GET", "/campaigns", director_token)
        if response and response.status_code == 200:
            campaigns = response.json()
            self.log_result("Director GET /api/campaigns", True, f"Director can view campaigns ({len(campaigns)} found)")
        else:
            self.log_result("Director GET /api/campaigns", False, f"Director cannot view campaigns: {response.status_code if response else 'No response'}")
        
        # 2.2 POST /api/campaigns - Director should NOT be able to create (403)
        response = self.make_request("POST", "/campaigns", director_token, test_campaign)
        if response and response.status_code == 403:
            self.log_result("Director POST /api/campaigns", True, "Director correctly blocked from creating campaigns (403)")
        else:
            self.log_result("Director POST /api/campaigns", False, 
                          f"Director not properly blocked: {response.status_code if response else 'No response'}")
        
        # 2.3 PATCH /api/campaigns/{id} - Director should NOT be able to edit (403)
        update_data = {"estado": "Finalizada"}
        response = self.make_request("PATCH", f"/campaigns/{campaign_id}", director_token, update_data)
        if response and response.status_code == 403:
            self.log_result("Director PATCH /api/campaigns/{id}", True, "Director correctly blocked from editing campaigns (403)")
        else:
            self.log_result("Director PATCH /api/campaigns/{id}", False,
                          f"Director not properly blocked: {response.status_code if response else 'No response'}")
        
        # 2.4 DELETE /api/campaigns/{id} - Director should NOT be able to delete (403)
        response = self.make_request("DELETE", f"/campaigns/{campaign_id}", director_token)
        if response and response.status_code == 403:
            self.log_result("Director DELETE /api/campaigns/{id}", True, "Director correctly blocked from deleting campaigns (403)")
        else:
            self.log_result("Director DELETE /api/campaigns/{id}", False,
                          f"Director not properly blocked: {response.status_code if response else 'No response'}")
        
        # Clean up test campaign
        response = self.make_request("DELETE", f"/campaigns/{campaign_id}", gerente_token)
        if response and response.status_code == 200:
            self.log_result("Test Cleanup", True, "Test campaign cleaned up successfully")

    def test_marketing_dashboard(self):
        """Test 3: Marketing Dashboard functionality"""
        print("=== TEST 3: MARKETING DASHBOARD ===\n")
        
        token = self.tokens.get("gerente")
        if not token:
            self.log_result("Dashboard Setup", False, "No token for Marketing Dashboard tests")
            return
        
        # 3.1 GET /api/marketing/dashboard - Default (month)
        response = self.make_request("GET", "/marketing/dashboard", token)
        if response and response.status_code == 200:
            dashboard_data = response.json()
            self.log_result("GET /api/marketing/dashboard", True, "Successfully retrieved marketing dashboard")
            
            # Verify required structure
            required_fields = [
                "total_leads", "total_facturadas", "conversion_rate", 
                "leads_by_origin", "campaign_metrics", "leads_by_day_of_week",
                "lead_trend", "funnel_data", "dca_performance", "asesor_performance"
            ]
            
            missing_fields = [f for f in required_fields if f not in dashboard_data]
            if not missing_fields:
                self.log_result("Dashboard Structure", True, "All required fields present in dashboard response")
                
                # Validate specific structures
                self.validate_dashboard_sections(dashboard_data)
            else:
                self.log_result("Dashboard Structure", False, f"Missing required fields: {missing_fields}")
        else:
            self.log_result("GET /api/marketing/dashboard", False, 
                          f"Status: {response.status_code if response else 'No response'}")
            return
        
        # 3.2 Test filter_type=day
        response = self.make_request("GET", "/marketing/dashboard", token, params={"filter_type": "day"})
        if response and response.status_code == 200:
            daily_data = response.json()
            self.log_result("Dashboard filter_type=day", True, f"Daily filter working, filter_type: {daily_data.get('filter_type')}")
        else:
            self.log_result("Dashboard filter_type=day", False, f"Status: {response.status_code if response else 'No response'}")
        
        # 3.3 Test filter_type=week  
        response = self.make_request("GET", "/marketing/dashboard", token, params={"filter_type": "week"})
        if response and response.status_code == 200:
            weekly_data = response.json()
            self.log_result("Dashboard filter_type=week", True, f"Weekly filter working, filter_type: {weekly_data.get('filter_type')}")
        else:
            self.log_result("Dashboard filter_type=week", False, f"Status: {response.status_code if response else 'No response'}")
        
        # 3.4 Test agency filter
        response = self.make_request("GET", "/marketing/dashboard", token, params={"agency": "Meridien"})
        if response and response.status_code == 200:
            agency_data = response.json()
            self.log_result("Dashboard agency=Meridien", True, "Agency filter working")
            
            # Verify filtering is working by checking if data is different or appropriately filtered
            if "campaign_metrics" in agency_data:
                meridien_campaigns = [c for c in agency_data["campaign_metrics"] if c.get("agencia") == "Meridien"]
                other_campaigns = [c for c in agency_data["campaign_metrics"] if c.get("agencia") != "Meridien"]
                
                if not other_campaigns or len(meridien_campaigns) >= len(other_campaigns):
                    self.log_result("Agency Filter Validation", True, "Agency filtering appears to be working correctly")
                else:
                    self.log_result("Agency Filter Validation", False, "Agency filtering may not be working properly")
        else:
            self.log_result("Dashboard agency=Meridien", False, f"Status: {response.status_code if response else 'No response'}")

    def validate_dashboard_sections(self, dashboard_data):
        """Validate specific dashboard sections"""
        
        # Check leads_by_origin structure
        if "leads_by_origin" in dashboard_data and isinstance(dashboard_data["leads_by_origin"], list):
            origins_valid = all("origin" in item and "count" in item for item in dashboard_data["leads_by_origin"])
            self.log_result("leads_by_origin Structure", origins_valid, 
                          f"Origins format valid: {len(dashboard_data['leads_by_origin'])} items")
        
        # Check campaign_metrics structure
        if "campaign_metrics" in dashboard_data and isinstance(dashboard_data["campaign_metrics"], list):
            campaigns_valid = True
            for campaign in dashboard_data["campaign_metrics"]:
                required_campaign_fields = ["id", "nombre", "agencia", "estado", "dias_activos", "leads_generados", "leads_por_dia"]
                if not all(field in campaign for field in required_campaign_fields):
                    campaigns_valid = False
                    break
            self.log_result("campaign_metrics Structure", campaigns_valid,
                          f"Campaign metrics format valid: {len(dashboard_data['campaign_metrics'])} items")
        
        # Check funnel_data structure
        if "funnel_data" in dashboard_data and isinstance(dashboard_data["funnel_data"], list):
            funnel_valid = all("stage" in item and "count" in item for item in dashboard_data["funnel_data"])
            self.log_result("funnel_data Structure", funnel_valid,
                          f"Funnel data format valid: {len(dashboard_data['funnel_data'])} stages")
        
        # Check dca_performance structure
        if "dca_performance" in dashboard_data and isinstance(dashboard_data["dca_performance"], list):
            dca_fields = ["dca_id", "dca_name", "total_leads", "contactados", "citados", "cumplidas"]
            dca_valid = all(all(field in item for field in dca_fields) for item in dashboard_data["dca_performance"])
            self.log_result("dca_performance Structure", dca_valid,
                          f"DCA performance format valid: {len(dashboard_data['dca_performance'])} DCAs")
        
        # Check asesor_performance structure
        if "asesor_performance" in dashboard_data and isinstance(dashboard_data["asesor_performance"], list):
            asesor_fields = ["asesor_id", "asesor_name", "total_asignados", "demos", "cierres", "facturadas", "conversion_rate"]
            asesor_valid = all(all(field in item for field in asesor_fields) for item in dashboard_data["asesor_performance"])
            self.log_result("asesor_performance Structure", asesor_valid,
                          f"Asesor performance format valid: {len(dashboard_data['asesor_performance'])} asesores")

    def test_configuration(self):
        """Test 4: Configuration endpoints"""
        print("=== TEST 4: CONFIGURACIÓN ===\n")
        
        # Config endpoint should be public or work with any token
        token = self.tokens.get("gerente")
        
        response = self.make_request("GET", "/config", token)
        if response and response.status_code == 200:
            config_data = response.json()
            self.log_result("GET /api/config", True, "Successfully retrieved configuration")
            
            # Check for campaign-specific configuration
            required_config = ["campaign_channels", "campaign_providers", "campaign_types", "campaign_statuses"]
            missing_config = [c for c in required_config if c not in config_data]
            
            if not missing_config:
                self.log_result("Campaign Configuration", True, "All campaign configuration fields present")
                
                # Validate specific campaign configs
                expected_channels = ["Planta", "Facebook Ads", "Web Ads"]
                expected_providers = ["Cronozz", "Interno"] 
                expected_types = ["Lead / Planta", "Ads / Facebook / Cronozz", "Ads / Web / Cronozz"]
                expected_statuses = ["Planeada", "Activa", "Finalizada"]
                
                channel_valid = set(config_data.get("campaign_channels", [])) >= set(expected_channels)
                provider_valid = set(config_data.get("campaign_providers", [])) >= set(expected_providers)
                type_valid = set(config_data.get("campaign_types", [])) >= set(expected_types)
                status_valid = set(config_data.get("campaign_statuses", [])) >= set(expected_statuses)
                
                self.log_result("Campaign Channels Config", channel_valid, f"Channels: {config_data.get('campaign_channels')}")
                self.log_result("Campaign Providers Config", provider_valid, f"Providers: {config_data.get('campaign_providers')}")
                self.log_result("Campaign Types Config", type_valid, f"Types: {config_data.get('campaign_types')}")
                self.log_result("Campaign Statuses Config", status_valid, f"Statuses: {config_data.get('campaign_statuses')}")
                
            else:
                self.log_result("Campaign Configuration", False, f"Missing campaign config: {missing_config}")
        else:
            self.log_result("GET /api/config", False, f"Status: {response.status_code if response else 'No response'}")

    def run_all_tests(self):
        """Run all test suites"""
        print("🔥 DCAPP V1 - CAMPAÑAS Y MARKETING DASHBOARD TESTING 🔥\n")
        print("Testing new modules according to review request\n")
        
        # Authenticate users
        if not self.authenticate_user(GERENTE_VENTAS_DIGITAL, "gerente"):
            print("❌ Cannot continue without Gerente de Ventas Digitales authentication")
            return
            
        if not self.authenticate_user(DIRECTOR, "director"):
            print("❌ Cannot continue without Director authentication")
            return
        
        print("✅ All users authenticated successfully\n")
        
        # Run test suites
        self.test_campaigns_crud_gerente()
        self.test_campaigns_permissions_director() 
        self.test_marketing_dashboard()
        self.test_configuration()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test results summary"""
        print("="*80)
        print("🎯 TEST EXECUTION SUMMARY")
        print("="*80)
        
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if r["success"]])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"📊 Results: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        
        if failed_tests > 0:
            print("\n🚨 FAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"   ❌ {result['test']}: {result['details']}")
        
        print(f"\n📋 Detailed results saved for main agent analysis")
        print("="*80)

if __name__ == "__main__":
    runner = TestRunner()
    runner.run_all_tests()