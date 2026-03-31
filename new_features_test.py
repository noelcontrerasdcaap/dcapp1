#!/usr/bin/env python3
"""
DCAPP V1 - New Features Testing
Test verification for the NEW IMPLEMENTATIONS according to review request

Review Request: Test the new implementations in DCAPP V1:

1. **Campaign Selector - Active Campaigns Endpoint:**
   - GET /api/campaigns/active?agency=Meridien - should return only active campaigns for Meridien
   - Verify the endpoint returns campaigns with estado='Activa'

2. **Lead Creation with Campaign ID:**
   - POST /api/leads with campaign_id field
   - Create a test lead with campaign_id set to an existing campaign
   - Verify the lead is created with the campaign_id

3. **Advanced Date Filters - Reports Overview:**
   - GET /api/reports/overview?filter_type=month (existing behavior should work)
   - GET /api/reports/overview?start_date_param=2025-01-01&end_date_param=2025-01-31 (custom date range)
   - Verify both return valid data structure

4. **Advanced Date Filters - Marketing Dashboard:**
   - GET /api/marketing/dashboard?filter_type=month (existing behavior)
   - GET /api/marketing/dashboard?start_date_param=2025-06-01&end_date_param=2025-06-30 (custom range)
   - Verify both return valid data structure with all required fields

Test credentials:
- Gerente de Ventas Digitales: gvd@dcapp.com / dcapp123
- DCA: dca.meridien@dcapp.com / dcapp123
"""

import requests
import json
import sys
from datetime import datetime, timedelta

BASE_URL = "https://dcapp-sales-hub.preview.emergentagent.com/api"

# Test credentials from review request
GVD_CREDENTIALS = {
    "email": "gvd@dcapp.com",
    "password": "dcapp123"
}

DCA_CREDENTIALS = {
    "email": "dca.meridien@dcapp.com", 
    "password": "dcapp123"
}

# Working credentials based on existing system
BACKUP_GVD = {
    "email": "gerente.ventas.digital@dcapp.com",
    "password": "dcapp123"
}

BACKUP_DCA = {
    "email": "director@dcapp.com",
    "password": "dcapp123"
}

class NewFeaturesTestRunner:
    def __init__(self):
        self.results = []
        self.tokens = {}
        self.test_campaign_id = None
        
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
        
    def authenticate_user(self, credentials, role_name, backup_credentials=None):
        """Authenticate user and store token"""
        try:
            response = requests.post(f"{BASE_URL}/auth/login", json=credentials)
            if response.status_code == 200:
                token_data = response.json()
                self.tokens[role_name] = token_data["access_token"]
                self.log_result(f"Authentication - {role_name}", True, f"Successfully authenticated {credentials['email']}")
                return True
            else:
                # Try backup credentials if available
                if backup_credentials:
                    print(f"   Primary credentials failed, trying backup for {role_name}")
                    backup_response = requests.post(f"{BASE_URL}/auth/login", json=backup_credentials)
                    if backup_response.status_code == 200:
                        token_data = backup_response.json()
                        self.tokens[role_name] = token_data["access_token"]
                        self.log_result(f"Authentication - {role_name} (backup)", True, f"Successfully authenticated {backup_credentials['email']}")
                        return True
                
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

    def setup_test_campaign(self):
        """Create a test campaign for testing purposes"""
        print("=== SETUP: Creating test campaign for feature testing ===\n")
        
        token = self.tokens.get("gvd")
        if not token:
            self.log_result("Setup - Campaign Creation", False, "No token for GVD")
            return False
        
        test_campaign = {
            "nombre": "Test Campaign Active",
            "agencia": "Meridien",
            "canal": "Facebook Ads",
            "proveedor": "Cronozz",
            "tipo_campana": "Ads / Facebook / Cronozz",
            "estado": "Activa"
        }
        
        response = self.make_request("POST", "/campaigns", token, test_campaign)
        if response and response.status_code == 200:
            campaign_data = response.json()
            self.test_campaign_id = campaign_data["id"]
            self.log_result("Setup - Campaign Creation", True, f"Created test campaign: {self.test_campaign_id}")
            return True
        else:
            self.log_result("Setup - Campaign Creation", False, f"Failed to create test campaign: {response.status_code if response else 'No response'}")
            return False

    def test_1_active_campaigns_endpoint(self):
        """Test 1: Campaign Selector - Active Campaigns Endpoint"""
        print("=== TEST 1: CAMPAIGN SELECTOR - ACTIVE CAMPAIGNS ENDPOINT ===\n")
        
        token = self.tokens.get("gvd")
        if not token:
            self.log_result("Test 1 Setup", False, "No token for GVD")
            return
        
        # 1.1 Test GET /api/campaigns/active without agency filter
        response = self.make_request("GET", "/campaigns/active", token)
        if response and response.status_code == 200:
            campaigns = response.json()
            self.log_result("GET /api/campaigns/active", True, f"Retrieved {len(campaigns)} active campaigns")
            
            # Verify all campaigns have estado='Activa'
            all_active = all(c.get("estado") == "Activa" for c in campaigns)
            if all_active:
                self.log_result("Active Campaigns Filter Validation", True, "All returned campaigns have estado='Activa'")
            else:
                inactive_campaigns = [c.get("nombre", "Unknown") for c in campaigns if c.get("estado") != "Activa"]
                self.log_result("Active Campaigns Filter Validation", False, f"Found non-active campaigns: {inactive_campaigns}")
        else:
            self.log_result("GET /api/campaigns/active", False, f"Status: {response.status_code if response else 'No response'}")
            return
        
        # 1.2 Test GET /api/campaigns/active?agency=Meridien
        response = self.make_request("GET", "/campaigns/active", token, params={"agency": "Meridien"})
        if response and response.status_code == 200:
            meridien_campaigns = response.json()
            self.log_result("GET /api/campaigns/active?agency=Meridien", True, f"Retrieved {len(meridien_campaigns)} active Meridien campaigns")
            
            # Verify all campaigns are for Meridien and active
            all_meridien = all(c.get("agencia") == "Meridien" for c in meridien_campaigns)
            all_active = all(c.get("estado") == "Activa" for c in meridien_campaigns)
            
            if all_meridien and all_active:
                self.log_result("Agency + Active Filter Validation", True, "All campaigns are Meridien and Active")
            else:
                non_meridien = [c.get("nombre", "Unknown") for c in meridien_campaigns if c.get("agencia") != "Meridien"]
                non_active = [c.get("nombre", "Unknown") for c in meridien_campaigns if c.get("estado") != "Activa"]
                self.log_result("Agency + Active Filter Validation", False, 
                              f"Non-Meridien campaigns: {non_meridien}, Non-active: {non_active}")
            
            # Check that our test campaign appears if it's for Meridien
            if self.test_campaign_id:
                test_campaign_found = any(c.get("id") == self.test_campaign_id for c in meridien_campaigns)
                if test_campaign_found:
                    self.log_result("Test Campaign in Active List", True, "Test campaign found in active Meridien campaigns")
                else:
                    self.log_result("Test Campaign in Active List", False, "Test campaign not found in active list")
        else:
            self.log_result("GET /api/campaigns/active?agency=Meridien", False, f"Status: {response.status_code if response else 'No response'}")

    def test_2_lead_creation_with_campaign_id(self):
        """Test 2: Lead Creation with Campaign ID"""
        print("=== TEST 2: LEAD CREATION WITH CAMPAIGN ID ===\n")
        
        token = self.tokens.get("gvd")  # Use GVD instead of DCA for lead creation
        if not token:
            self.log_result("Test 2 Setup", False, "No token for GVD")
            return
        
        if not self.test_campaign_id:
            self.log_result("Test 2 Setup", False, "No test campaign available")
            return
        
        # Get a DCA user ID for lead creation
        response = self.make_request("GET", "/users", token, params={"role": "DCA", "agency": "Meridien"})
        if not response or response.status_code != 200:
            self.log_result("Get DCA for Lead", False, "Could not retrieve DCA user")
            return
        
        dcas = response.json()
        if not dcas:
            self.log_result("Get DCA for Lead", False, "No DCA found for Meridien")
            return
        
        dca_id = dcas[0]["id"]
        
        # 2.1 Create lead WITH campaign_id
        lead_with_campaign = {
            "name": "Test Lead Con Campaña",
            "phone": "555-1234-CAMP",
            "agency": "Meridien",
            "origin": "Facebook",
            "campaign": "Test Campaign",
            "campaign_id": self.test_campaign_id,
            "dca_id": dca_id
        }
        
        response = self.make_request("POST", "/leads", token, lead_with_campaign)
        if response and response.status_code == 200:
            lead_data = response.json()
            lead_id = lead_data["id"]
            self.log_result("POST /api/leads with campaign_id", True, f"Created lead with campaign_id: {lead_id}")
            
            # Verify campaign_id is stored
            if lead_data.get("campaign_id") == self.test_campaign_id:
                self.log_result("Campaign ID Storage Validation", True, f"Lead correctly stores campaign_id: {self.test_campaign_id}")
            else:
                self.log_result("Campaign ID Storage Validation", False, 
                              f"Expected campaign_id: {self.test_campaign_id}, Got: {lead_data.get('campaign_id')}")
            
            # 2.2 Retrieve the lead to verify campaign_id persistence
            response = self.make_request("GET", f"/leads/{lead_id}", token)
            if response and response.status_code == 200:
                retrieved_lead = response.json()
                if retrieved_lead.get("campaign_id") == self.test_campaign_id:
                    self.log_result("Campaign ID Persistence Validation", True, "Campaign ID persisted correctly after retrieval")
                else:
                    self.log_result("Campaign ID Persistence Validation", False, 
                                  f"Campaign ID not persisted correctly: {retrieved_lead.get('campaign_id')}")
            else:
                self.log_result("Campaign ID Persistence Validation", False, "Could not retrieve lead for validation")
                
        else:
            self.log_result("POST /api/leads with campaign_id", False, 
                          f"Status: {response.status_code if response else 'No response'}, "
                          f"Response: {response.text if response else 'None'}")
        
        # 2.3 Create lead WITHOUT campaign_id (should still work)
        lead_without_campaign = {
            "name": "Test Lead Sin Campaña",
            "phone": "555-1234-NOCAMP",
            "agency": "Meridien",
            "origin": "Google Ads",
            "campaign": "",
            "dca_id": dca_id
        }
        
        response = self.make_request("POST", "/leads", token, lead_without_campaign)
        if response and response.status_code == 200:
            lead_data = response.json()
            self.log_result("POST /api/leads without campaign_id", True, f"Created lead without campaign_id: {lead_data['id']}")
            
            # Verify campaign_id is None or not present
            campaign_id = lead_data.get("campaign_id")
            if campaign_id is None:
                self.log_result("No Campaign ID Validation", True, "Lead correctly has no campaign_id when not provided")
            else:
                self.log_result("No Campaign ID Validation", False, f"Unexpected campaign_id: {campaign_id}")
        else:
            self.log_result("POST /api/leads without campaign_id", False, f"Status: {response.status_code if response else 'No response'}")

    def test_3_advanced_date_filters_reports(self):
        """Test 3: Advanced Date Filters - Reports Overview"""
        print("=== TEST 3: ADVANCED DATE FILTERS - REPORTS OVERVIEW ===\n")
        
        token = self.tokens.get("gvd")
        if not token:
            self.log_result("Test 3 Setup", False, "No token for GVD")
            return
        
        # 3.1 Test existing behavior - filter_type=month
        response = self.make_request("GET", "/reports/overview", token, params={"filter_type": "month"})
        if response and response.status_code == 200:
            monthly_data = response.json()
            self.log_result("GET /api/reports/overview?filter_type=month", True, "Existing monthly filter behavior working")
            
            # Verify required structure
            required_fields = ["global_totals", "by_agency", "by_origin", "by_campaign", "top_dcas"]
            missing_fields = [f for f in required_fields if f not in monthly_data]
            if not missing_fields:
                self.log_result("Monthly Reports Structure", True, "All required fields present in monthly reports")
            else:
                self.log_result("Monthly Reports Structure", False, f"Missing fields: {missing_fields}")
        else:
            self.log_result("GET /api/reports/overview?filter_type=month", False, f"Status: {response.status_code if response else 'No response'}")
            return
        
        # 3.2 Test NEW custom date range functionality
        params = {
            "start_date_param": "2025-01-01",
            "end_date_param": "2025-01-31"
        }
        response = self.make_request("GET", "/reports/overview", token, params=params)
        if response and response.status_code == 200:
            custom_data = response.json()
            self.log_result("GET /api/reports/overview with custom date range", True, "Custom date range filtering working")
            
            # Verify same structure as monthly
            required_fields = ["global_totals", "by_agency", "by_origin", "by_campaign", "top_dcas"]
            missing_fields = [f for f in required_fields if f not in custom_data]
            if not missing_fields:
                self.log_result("Custom Date Reports Structure", True, "All required fields present in custom date reports")
            else:
                self.log_result("Custom Date Reports Structure", False, f"Missing fields: {missing_fields}")
            
            # Verify global_totals structure
            if "global_totals" in custom_data:
                global_totals = custom_data["global_totals"]
                required_global = ["total_leads", "total_facturadas", "monto_total", "unidades_total"]
                missing_global = [f for f in required_global if f not in global_totals]
                if not missing_global:
                    self.log_result("Global Totals Structure", True, "Global totals structure complete")
                else:
                    self.log_result("Global Totals Structure", False, f"Missing global fields: {missing_global}")
            
            # Verify by_agency structure with sales_detail
            if "by_agency" in custom_data and custom_data["by_agency"]:
                agency_data = custom_data["by_agency"][0]
                required_agency = ["agency", "total_leads", "facturadas", "monto_total", "unidades_total", "sales_detail"]
                missing_agency = [f for f in required_agency if f not in agency_data]
                if not missing_agency:
                    self.log_result("By Agency Structure", True, "Agency data structure complete")
                else:
                    self.log_result("By Agency Structure", False, f"Missing agency fields: {missing_agency}")
        else:
            self.log_result("GET /api/reports/overview with custom date range", False, f"Status: {response.status_code if response else 'No response'}")

    def test_4_advanced_date_filters_marketing_dashboard(self):
        """Test 4: Advanced Date Filters - Marketing Dashboard"""
        print("=== TEST 4: ADVANCED DATE FILTERS - MARKETING DASHBOARD ===\n")
        
        token = self.tokens.get("gvd")
        if not token:
            self.log_result("Test 4 Setup", False, "No token for GVD")
            return
        
        # 4.1 Test existing behavior - filter_type=month
        response = self.make_request("GET", "/marketing/dashboard", token, params={"filter_type": "month"})
        if response and response.status_code == 200:
            monthly_data = response.json()
            self.log_result("GET /api/marketing/dashboard?filter_type=month", True, "Existing monthly filter behavior working")
            
            # Verify required structure
            required_fields = [
                "total_leads", "total_facturadas", "conversion_rate",
                "leads_by_origin", "campaign_metrics", "leads_by_day_of_week",
                "lead_trend", "funnel_data", "dca_performance", "asesor_performance"
            ]
            missing_fields = [f for f in required_fields if f not in monthly_data]
            if not missing_fields:
                self.log_result("Monthly Marketing Dashboard Structure", True, "All required fields present")
            else:
                self.log_result("Monthly Marketing Dashboard Structure", False, f"Missing fields: {missing_fields}")
                
            # Additional structure validation
            self.validate_marketing_dashboard_structure(monthly_data, "Monthly")
            
        else:
            self.log_result("GET /api/marketing/dashboard?filter_type=month", False, f"Status: {response.status_code if response else 'No response'}")
            return
        
        # 4.2 Test NEW custom date range functionality
        params = {
            "start_date_param": "2025-06-01",
            "end_date_param": "2025-06-30"
        }
        response = self.make_request("GET", "/marketing/dashboard", token, params=params)
        if response and response.status_code == 200:
            custom_data = response.json()
            self.log_result("GET /api/marketing/dashboard with custom date range", True, "Custom date range filtering working")
            
            # Verify same structure as monthly
            required_fields = [
                "total_leads", "total_facturadas", "conversion_rate",
                "leads_by_origin", "campaign_metrics", "leads_by_day_of_week",
                "lead_trend", "funnel_data", "dca_performance", "asesor_performance"
            ]
            missing_fields = [f for f in required_fields if f not in custom_data]
            if not missing_fields:
                self.log_result("Custom Date Marketing Dashboard Structure", True, "All required fields present")
            else:
                self.log_result("Custom Date Marketing Dashboard Structure", False, f"Missing fields: {missing_fields}")
            
            # Additional structure validation
            self.validate_marketing_dashboard_structure(custom_data, "Custom Date")
            
        else:
            self.log_result("GET /api/marketing/dashboard with custom date range", False, f"Status: {response.status_code if response else 'No response'}")

    def validate_marketing_dashboard_structure(self, data, test_prefix):
        """Validate detailed marketing dashboard structure"""
        
        # Check leads_by_origin structure
        if "leads_by_origin" in data and isinstance(data["leads_by_origin"], list):
            origins_valid = all("origin" in item and "count" in item for item in data["leads_by_origin"])
            self.log_result(f"{test_prefix} - leads_by_origin Structure", origins_valid, 
                          f"Origins format valid: {len(data['leads_by_origin'])} items")
        
        # Check campaign_metrics structure
        if "campaign_metrics" in data and isinstance(data["campaign_metrics"], list):
            campaigns_valid = True
            for campaign in data["campaign_metrics"]:
                required_campaign_fields = ["id", "nombre", "agencia", "estado", "dias_activos", "leads_generados", "leads_por_dia"]
                if not all(field in campaign for field in required_campaign_fields):
                    campaigns_valid = False
                    break
            self.log_result(f"{test_prefix} - campaign_metrics Structure", campaigns_valid,
                          f"Campaign metrics format valid: {len(data['campaign_metrics'])} items")
        
        # Check funnel_data structure
        if "funnel_data" in data and isinstance(data["funnel_data"], list):
            funnel_valid = all("stage" in item and "count" in item for item in data["funnel_data"])
            self.log_result(f"{test_prefix} - funnel_data Structure", funnel_valid,
                          f"Funnel data format valid: {len(data['funnel_data'])} stages")
        
        # Check dca_performance structure
        if "dca_performance" in data and isinstance(data["dca_performance"], list):
            dca_fields = ["dca_id", "dca_name", "total_leads", "contactados", "citados", "cumplidas"]
            dca_valid = all(all(field in item for field in dca_fields) for item in data["dca_performance"])
            self.log_result(f"{test_prefix} - dca_performance Structure", dca_valid,
                          f"DCA performance format valid: {len(data['dca_performance'])} DCAs")
        
        # Check asesor_performance structure
        if "asesor_performance" in data and isinstance(data["asesor_performance"], list):
            asesor_fields = ["asesor_id", "asesor_name", "total_asignados", "demos", "cierres", "facturadas", "conversion_rate"]
            asesor_valid = all(all(field in item for field in asesor_fields) for item in data["asesor_performance"])
            self.log_result(f"{test_prefix} - asesor_performance Structure", asesor_valid,
                          f"Asesor performance format valid: {len(data['asesor_performance'])} asesores")

    def cleanup_test_data(self):
        """Clean up test campaign created during testing"""
        print("=== CLEANUP: Removing test data ===\n")
        
        if self.test_campaign_id:
            token = self.tokens.get("gvd")
            if token:
                response = self.make_request("DELETE", f"/campaigns/{self.test_campaign_id}", token)
                if response and response.status_code == 200:
                    self.log_result("Cleanup - Test Campaign Deletion", True, "Test campaign deleted successfully")
                else:
                    self.log_result("Cleanup - Test Campaign Deletion", False, "Failed to delete test campaign")

    def run_all_tests(self):
        """Run all new feature tests"""
        print("🚀 DCAPP V1 - NEW FEATURES TESTING 🚀\n")
        print("Testing NEW implementations according to review request\n")
        print("Focus: Campaign Selector, Lead Campaign ID, Advanced Date Filters\n")
        
        # Authenticate users
        if not self.authenticate_user(GVD_CREDENTIALS, "gvd", BACKUP_GVD):
            print("❌ Cannot continue without GVD authentication")
            return
            
        if not self.authenticate_user(DCA_CREDENTIALS, "dca", BACKUP_DCA):
            print("❌ Cannot continue without DCA authentication")
            return
        
        print("✅ All users authenticated successfully\n")
        
        # Setup test data
        if not self.setup_test_campaign():
            print("❌ Cannot continue without test campaign")
            return
        
        # Run new feature tests
        self.test_1_active_campaigns_endpoint()
        self.test_2_lead_creation_with_campaign_id()
        self.test_3_advanced_date_filters_reports()
        self.test_4_advanced_date_filters_marketing_dashboard()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test results summary"""
        print("="*80)
        print("🎯 NEW FEATURES TEST EXECUTION SUMMARY")
        print("="*80)
        
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if r["success"]])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"📊 Results: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        
        # Group results by feature
        feature_groups = {
            "Authentication": [r for r in self.results if "Authentication" in r["test"]],
            "Setup/Cleanup": [r for r in self.results if "Setup" in r["test"] or "Cleanup" in r["test"]],
            "Campaign Selector": [r for r in self.results if "Test 1" in r["test"] or "Active Campaigns" in r["test"]],
            "Lead Campaign ID": [r for r in self.results if "Test 2" in r["test"] or "campaign_id" in r["test"]],
            "Reports Date Filters": [r for r in self.results if "Test 3" in r["test"] or "Reports" in r["test"]],
            "Marketing Dashboard Filters": [r for r in self.results if "Test 4" in r["test"] or "Marketing Dashboard" in r["test"]]
        }
        
        print("\n📋 RESULTS BY FEATURE:")
        for feature, tests in feature_groups.items():
            if tests:
                feature_passed = len([t for t in tests if t["success"]])
                feature_total = len(tests)
                feature_rate = (feature_passed / feature_total * 100) if feature_total > 0 else 0
                print(f"   {feature}: {feature_passed}/{feature_total} ({feature_rate:.1f}%)")
        
        if failed_tests > 0:
            print(f"\n🚨 FAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"   ❌ {result['test']}: {result['details']}")
        
        print(f"\n📋 Detailed results logged for main agent analysis")
        print("="*80)

if __name__ == "__main__":
    runner = NewFeaturesTestRunner()
    runner.run_all_tests()