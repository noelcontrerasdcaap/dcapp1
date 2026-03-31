#!/usr/bin/env python3
"""
Create Gerente de Ventas Digitales directly in MongoDB to resolve permission deadlock
"""

import pymongo
import bcrypt
from datetime import datetime
import os

# MongoDB connection
client = pymongo.MongoClient("mongodb://localhost:27017")
db = client["test_database"]

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_gerente_ventas_digitales():
    """Create a Gerente de Ventas Digitales user directly"""
    
    # Check if already exists
    existing = db.users.find_one({"role": "Gerente de Ventas Digitales"})
    if existing:
        print(f"Gerente de Ventas Digitales already exists: {existing['name']} ({existing['email']})")
        return existing
    
    # Create the user
    gerente_data = {
        "email": "gerente.ventas.digital@dcapp.com",
        "password": hash_password("dcapp123"),
        "name": "Gerente de Ventas Digitales",
        "role": "Gerente de Ventas Digitales",
        "agency": "Meridien",
        "agencies": ["Meridien", "Jetour", "Cadillac"],
        "active": True,
        "created_at": datetime.utcnow()
    }
    
    result = db.users.insert_one(gerente_data)
    gerente_data["_id"] = result.inserted_id
    
    print(f"✅ Created Gerente de Ventas Digitales: {gerente_data['name']} ({gerente_data['email']})")
    return gerente_data

def create_asesor_digital():
    """Create an Asesor Digital user"""
    
    # Check if already exists
    existing = db.users.find_one({"email": "asesor.digital.test@dcapp.com"})
    if existing:
        print(f"Asesor Digital already exists: {existing['name']} ({existing['email']})")
        return existing
    
    # Create the user
    asesor_data = {
        "email": "asesor.digital.test@dcapp.com",
        "password": hash_password("dcapp123"),
        "name": "Asesor Digital Test",
        "role": "Asesor Digital",
        "agency": "Meridien",
        "agencies": ["Meridien"],
        "active": True,
        "created_at": datetime.utcnow()
    }
    
    result = db.users.insert_one(asesor_data)
    asesor_data["_id"] = result.inserted_id
    
    print(f"✅ Created Asesor Digital: {asesor_data['name']} ({asesor_data['email']})")
    return asesor_data

if __name__ == "__main__":
    print("🔧 Creating required users for permission testing...")
    
    try:
        gerente = create_gerente_ventas_digitales()
        asesor = create_asesor_digital()
        
        print("\n✅ All required users created successfully!")
        print("You can now test with:")
        print("- gerente.ventas.digital@dcapp.com / dcapp123")
        print("- asesor.digital.test@dcapp.com / dcapp123")
        
    except Exception as e:
        print(f"❌ Error creating users: {e}")