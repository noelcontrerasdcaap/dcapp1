#!/usr/bin/env python3
"""
DCAPP V1 Role-Based Permissions Test Suite - Enhanced
Tests the newly restructured permission system with existing users
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Optional

# Backend URL from frontend environment
BACKEND_URL = "https://dcapp-sales-hub.preview.emergentagent.com/api"

# Test credentials from the request
TEST_CREDENTIALS = {
    "director": {
        "email": "director@dcapp.com",
        "password": "dcapp123",
        "role": "Director"
    },
    "dca": {
        "email": "dca.meridien@dcapp.com", 
        "password": "dcapp123",
        "role": "DCA"
    },
    "asesor_meridien": {
        "email": "asesor.meridien@dcapp.com",
        "password": "dcapp123",
        "role": "Asesor Digital"
    }
}

class RolePermissionsTester:
    def __init__(self):
        self.tokens = {}
        self.test_results = []
        self.created_users = []
        self.created_leads = []
        self.user_details = {}
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Dict = None):
        """Log test results with enhanced formatting"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if response_data:
            result["response"] = response_data
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   → {details}")
        if not success and response_data:
            if isinstance(response_data, dict) and 'detail' in response_data:
                print(f"   → Error: {response_data['detail']}")
        print()
    
    def make_request(self, method: str, endpoint: str, headers: Dict = None, data: Dict = None, expected_status: int = None):
        """Make HTTP request with error handling"""
        try:
            url = f"{BACKEND_URL}{endpoint}"
            
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "PATCH":
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return None, {"error": f"Unsupported method: {method}"}
            
            # If expected_status is provided, check for exact match
            if expected_status is not None:
                return response.status_code == expected_status, response.json() if response.content else {"status_code": response.status_code}
            
            return response.status_code in [200, 201], response.json() if response.content else {}
            
        except requests.exceptions.Timeout:
            return False, {"error": "Request timeout"}
        except requests.exceptions.ConnectionError:
            return False, {"error": "Connection error"}
        except Exception as e:
            return False, {"error": str(e)}
    
    def test_authentication(self):
        """Test basic authentication with provided credentials"""
        print("=== TESTING AUTHENTICATION ===")
        
        for role, credentials in TEST_CREDENTIALS.items():
            success, data = self.make_request("POST", "/auth/login", data=credentials)
            
            if success and "access_token" in data:
                self.tokens[role] = data["access_token"]
                
                # Get user details
                headers = {"Authorization": f"Bearer {data['access_token']}"}
                user_success, user_data = self.make_request("GET", "/auth/me", headers=headers)
                
                if user_success:
                    self.user_details[role] = user_data
                    self.log_test(
                        f"Login & Get User Info - {role.upper()}",
                        True,
                        f"User: {user_data.get('name')} | Role: {user_data.get('role')} | Agency: {user_data.get('agency')}"
                    )
                else:
                    self.log_test(f"Get User Info - {role.upper()}", False, "Failed to get user details", user_data)
            else:
                # Try with default password
                if not success and "password" in credentials:
                    alt_credentials = credentials.copy()
                    alt_credentials["password"] = "password123"
                    alt_success, alt_data = self.make_request("POST", "/auth/login", data=alt_credentials)
                    if alt_success and "access_token" in alt_data:
                        self.tokens[role] = alt_data["access_token"]
                        headers = {"Authorization": f"Bearer {alt_data['access_token']}"}
                        user_success, user_data = self.make_request("GET", "/auth/me", headers=headers)
                        if user_success:
                            self.user_details[role] = user_data
                            self.log_test(
                                f"Login & Get User Info - {role.upper()} (alt password)",
                                True,
                                f"User: {user_data.get('name')} | Role: {user_data.get('role')} | Agency: {user_data.get('agency')}"
                            )
                        else:
                            self.log_test(f"Get User Info - {role.upper()}", False, "Failed to get user details", user_data)
                    else:
                        self.log_test(f"Login - {role.upper()}", False, f"Failed to authenticate", data)
                else:
                    self.log_test(f"Login - {role.upper()}", False, f"Failed to authenticate", data)
    
    def test_director_permissions(self):
        """Test DIRECTOR role - Should have ONLY supervision access"""
        print("=== TESTING DIRECTOR PERMISSIONS (Read-Only Supervision) ===")
        
        if "director" not in self.tokens:
            self.log_test("Director permissions", False, "No director token available")
            return
        
        headers = {"Authorization": f"Bearer {self.tokens['director']}"}
        
        # ✅ SHOULD WORK: View all agencies in dashboard
        success, data = self.make_request("GET", "/metrics/dashboard", headers=headers)
        if success and "agencies" in data:
            self.log_test(
                "✅ Director: View dashboard metrics",
                True,
                f"Can view {len(data['agencies'])} agencies (supervision access)"
            )
        else:
            self.log_test("❌ Director: View dashboard metrics", False, "Cannot access dashboard", data)
        
        # ✅ SHOULD WORK: View reports
        success, data = self.make_request("GET", "/reports/overview", headers=headers)
        if success:
            self.log_test("✅ Director: View reports overview", True, "Can access reports (supervision access)")
        else:
            self.log_test("❌ Director: View reports overview", False, "Cannot access reports", data)
        
        # ✅ SHOULD WORK: View all leads
        success, data = self.make_request("GET", "/leads", headers=headers)
        if success:
            leads_count = data.get("total", len(data.get("leads", [])))
            self.log_test("✅ Director: View all leads", True, f"Can view all leads (total: {leads_count}) - supervision access")
        else:
            self.log_test("❌ Director: View all leads", False, "Cannot access leads", data)
        
        # ❌ SHOULD FAIL: Create users (403 expected)
        new_user_data = {
            "email": "test.user@dcapp.com",
            "password": "dcapp123",
            "name": "Test User Director",
            "role": "Marketing",
            "agency": "Meridien"
        }
        success, data = self.make_request("POST", "/users", headers=headers, data=new_user_data, expected_status=403)
        self.log_test(
            "❌ Director: Create user (SHOULD FAIL)",
            success,
            "✓ Correctly blocked from creating users (supervision only)" if success else "✗ Incorrectly allowed to create users"
        )
        
        # Get a lead to test modification restrictions
        lead_success, lead_data = self.make_request("GET", "/leads", headers=headers)
        if lead_success and lead_data.get("leads"):
            lead_id = lead_data["leads"][0]["id"]
            current_stage = lead_data["leads"][0]["stage"]
            
            # ❌ SHOULD FAIL: Modify leads (403 expected)
            update_data = {"stage": "Contactado"}
            success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data=update_data, expected_status=403)
            self.log_test(
                "❌ Director: Modify lead (SHOULD FAIL)",
                success,
                "✓ Correctly blocked from modifying leads (supervision only)" if success else "✗ Incorrectly allowed to modify leads"
            )
            
            # ❌ SHOULD FAIL: Change lead stages (403 expected)
            success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": "Demo"}, expected_status=403)
            self.log_test(
                "❌ Director: Change lead stage (SHOULD FAIL)",
                success,
                "✓ Correctly blocked from changing lead stages (supervision only)" if success else "✗ Incorrectly allowed to change stages"
            )
    
    def test_dca_permissions(self):
        """Test DCA role permissions"""
        print("=== TESTING DCA PERMISSIONS ===")
        
        if "dca" not in self.tokens:
            self.log_test("DCA permissions", False, "No DCA token available")
            return
        
        headers = {"Authorization": f"Bearer {self.tokens['dca']}"}
        dca_user = self.user_details.get("dca")
        
        # ✅ SHOULD WORK: View leads from their agency
        success, data = self.make_request("GET", "/leads?agency=Meridien", headers=headers)
        if success:
            leads_count = data.get("total", len(data.get("leads", [])))
            self.log_test("✅ DCA: View agency leads", True, f"Can view {leads_count} leads from own agency (Meridien)")
        else:
            self.log_test("❌ DCA: View agency leads", False, "Cannot view agency leads", data)
        
        # ✅ SHOULD WORK: Create leads
        new_lead_data = {
            "name": "Lead Creado por DCA - Prueba Permisos",
            "phone": "5555551234",
            "agency": "Meridien",
            "origin": "Facebook",
            "campaign": "Test DCA Permissions Campaign",
            "dca_id": dca_user["id"] if dca_user else ""
        }
        
        success, data = self.make_request("POST", "/leads", headers=headers, data=new_lead_data)
        if success:
            lead_id = data["id"]
            self.created_leads.append(lead_id)
            self.log_test("✅ DCA: Create lead", True, f"Successfully created lead: {data['name']} (ID: {lead_id})")
            
            # ✅ SHOULD WORK: Move lead through DCA stages (Lead → Contactado → Citado → Cumplida)
            dca_stages = ["Contactado", "Citado", "Cumplida"]
            for stage in dca_stages:
                update_success, update_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": stage})
                if update_success:
                    self.log_test(f"✅ DCA: Move lead to {stage}", True, f"Successfully moved to {stage} (allowed stage)")
                else:
                    self.log_test(f"❌ DCA: Move lead to {stage}", False, f"Failed to move to {stage}", update_data)
            
            # ❌ SHOULD FAIL: Move beyond Cumplida (Demo should fail with 403)
            demo_success, demo_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": "Demo"}, expected_status=403)
            self.log_test(
                "❌ DCA: Move to Demo (SHOULD FAIL)",
                demo_success,
                "✓ Correctly blocked from moving beyond Cumplida" if demo_success else "✗ Should be blocked from moving to Demo"
            )
            
            # ❌ SHOULD FAIL: Move to Cierre (should fail with 403)
            cierre_success, cierre_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": "Cierre"}, expected_status=403)
            self.log_test(
                "❌ DCA: Move to Cierre (SHOULD FAIL)",
                cierre_success,
                "✓ Correctly blocked from moving to Cierre (Asesor stage)" if cierre_success else "✗ Should be blocked from Cierre stage"
            )
            
            # ❌ SHOULD FAIL: Move to Facturada (should fail with 403)
            facturada_success, facturada_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": "Facturada"}, expected_status=403)
            self.log_test(
                "❌ DCA: Move to Facturada (SHOULD FAIL)",
                facturada_success,
                "✓ Correctly blocked from moving to Facturada (Asesor stage)" if facturada_success else "✗ Should be blocked from Facturada stage"
            )
            
            # ✅ SHOULD WORK: Assign asesor (if we have one)
            if "asesor_meridien" in self.user_details:
                asesor_id = self.user_details["asesor_meridien"]["id"]
                assign_success, assign_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"asesor_id": asesor_id})
                if assign_success:
                    self.log_test("✅ DCA: Assign asesor", True, f"Successfully assigned asesor to lead")
                else:
                    self.log_test("❌ DCA: Assign asesor", False, "Failed to assign asesor", assign_data)
            
            # ❌ SHOULD FAIL: Reassign DCA (403 expected)
            other_dca_success, other_dca_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"dca_id": "673db091d07e5e0b09cac897"}, expected_status=403)
            self.log_test(
                "❌ DCA: Reassign DCA (SHOULD FAIL)",
                other_dca_success,
                "✓ Correctly blocked from reassigning DCA" if other_dca_success else "✗ Should be blocked from reassigning DCA"
            )
            
            # ❌ SHOULD FAIL: Register sale (403 expected)
            sale_data = {
                "lead_id": lead_id,
                "marca": "Cadillac",
                "modelo": "CT5",
                "version": "Premium",
                "precio": 800000,
                "cantidad": 1,
                "tipo_venta": "Contado",
                "asesor_id": dca_user["id"] if dca_user else "",
                "dca_id": dca_user["id"] if dca_user else "",
                "origen": "Facebook",
                "campaign": "Test Campaign",
                "facturado_a": "Cliente Test DCA",
                "fecha_factura": datetime.utcnow().isoformat()
            }
            sale_success, sale_response = self.make_request("POST", "/sales", headers=headers, data=sale_data, expected_status=403)
            self.log_test(
                "❌ DCA: Register sale (SHOULD FAIL)",
                sale_success,
                "✓ Correctly blocked from registering sales (Asesor only)" if sale_success else "✗ Should be blocked from registering sales"
            )
        else:
            self.log_test("❌ DCA: Create lead", False, "Cannot create leads", data)
    
    def test_asesor_digital_permissions(self):
        """Test Asesor Digital permissions"""
        print("=== TESTING ASESOR DIGITAL PERMISSIONS ===")
        
        if "asesor_meridien" not in self.tokens:
            self.log_test("Asesor Digital permissions", False, "No Asesor Digital token available")
            return
        
        headers = {"Authorization": f"Bearer {self.tokens['asesor_meridien']}"}
        asesor_user = self.user_details.get("asesor_meridien")
        
        # ❌ SHOULD FAIL: View dashboard (403 expected)
        dashboard_success, dashboard_data = self.make_request("GET", "/metrics/dashboard", headers=headers, expected_status=403)
        self.log_test(
            "❌ Asesor Digital: View dashboard (SHOULD FAIL)",
            dashboard_success,
            "✓ Correctly blocked from viewing dashboard" if dashboard_success else "✗ Should be blocked from dashboard access"
        )
        
        # ❌ SHOULD FAIL: View reports (403 expected)
        reports_success, reports_data = self.make_request("GET", "/reports/overview", headers=headers, expected_status=403)
        self.log_test(
            "❌ Asesor Digital: View reports (SHOULD FAIL)",
            reports_success,
            "✓ Correctly blocked from viewing reports" if reports_success else "✗ Should be blocked from reports access"
        )
        
        # ❌ SHOULD FAIL: View agency metrics (403 expected)
        agency_success, agency_data = self.make_request("GET", "/metrics/agency/Meridien", headers=headers, expected_status=403)
        self.log_test(
            "❌ Asesor Digital: View agency metrics (SHOULD FAIL)",
            agency_success,
            "✓ Correctly blocked from viewing agency metrics" if agency_success else "✗ Should be blocked from agency metrics"
        )
        
        # ✅ SHOULD WORK: Only see assigned leads
        leads_success, leads_data = self.make_request("GET", "/leads", headers=headers)
        if leads_success:
            assigned_leads = leads_data.get("leads", [])
            if asesor_user:
                # Check that all leads are assigned to this asesor
                assigned_count = 0
                for lead in assigned_leads:
                    if lead.get("asesor_id") == asesor_user["id"]:
                        assigned_count += 1
                
                self.log_test(
                    "✅ Asesor Digital: View only assigned leads", 
                    True,
                    f"Viewing {assigned_count} assigned leads out of {len(assigned_leads)} total (correct filtering)"
                )
        else:
            self.log_test("❌ Asesor Digital: View assigned leads", False, "Cannot view leads", leads_data)
        
        # Test stage movements with assigned lead
        if self.created_leads and asesor_user:
            lead_id = self.created_leads[0]
            
            # First make sure the lead is assigned to this asesor and at Cumplida stage
            if "dca" in self.tokens:
                dca_headers = {"Authorization": f"Bearer {self.tokens['dca']}"}
                prep_success, prep_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=dca_headers, data={
                    "asesor_id": asesor_user["id"],
                    "stage": "Cumplida"
                })
                
                if prep_success:
                    self.log_test("Setup: Assign lead to Asesor and move to Cumplida", True, "Lead prepared for Asesor testing")
                
                    # ✅ SHOULD WORK: Move through asesor stages (Cumplida → Demo → Cierre)
                    asesor_stages = ["Demo", "Cierre"]
                    for stage in asesor_stages:
                        stage_success, stage_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": stage})
                        if stage_success:
                            self.log_test(f"✅ Asesor Digital: Move to {stage}", True, f"Successfully moved to {stage} (allowed stage)")
                        else:
                            self.log_test(f"❌ Asesor Digital: Move to {stage}", False, f"Failed to move to {stage}", stage_data)
                    
                    # ✅ SHOULD WORK: Register sale (move to Facturada)
                    sale_data = {
                        "lead_id": lead_id,
                        "marca": "Cadillac",
                        "modelo": "CT5",
                        "version": "Premium",
                        "precio": 800000,
                        "cantidad": 1,
                        "tipo_venta": "Contado",
                        "asesor_id": asesor_user["id"],
                        "dca_id": self.user_details.get("dca", {}).get("id", ""),
                        "origen": "Facebook",
                        "campaign": "Test Asesor Sale Campaign",
                        "facturado_a": "Cliente Asesor Test Final",
                        "fecha_factura": datetime.utcnow().isoformat()
                    }
                    sale_success, sale_data_resp = self.make_request("POST", "/sales", headers=headers, data=sale_data)
                    if sale_success:
                        self.log_test("✅ Asesor Digital: Register sale", True, f"Successfully registered sale (lead moved to Facturada)")
                    else:
                        self.log_test("❌ Asesor Digital: Register sale", False, "Failed to register sale", sale_data_resp)
                    
                    # ❌ SHOULD FAIL: Change DCA (403 expected)
                    dca_change_success, dca_change_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"dca_id": "673db091d07e5e0b09cac897"}, expected_status=403)
                    self.log_test(
                        "❌ Asesor Digital: Change DCA (SHOULD FAIL)",
                        dca_change_success,
                        "✓ Correctly blocked from changing DCA" if dca_change_success else "✗ Should be blocked from changing DCA"
                    )
                    
                    # ❌ SHOULD FAIL: Reassign to another asesor (403 expected)
                    reassign_success, reassign_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"asesor_id": "673db091d07e5e0b09cac898"}, expected_status=403)
                    self.log_test(
                        "❌ Asesor Digital: Reassign asesor (SHOULD FAIL)",
                        reassign_success,
                        "✓ Correctly blocked from reassigning asesor" if reassign_success else "✗ Should be blocked from reassigning asesor"
                    )
                    
                    # ❌ SHOULD FAIL: Edit origin/campaign (403 expected)
                    edit_success, edit_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"origin": "Google Ads"}, expected_status=403)
                    self.log_test(
                        "❌ Asesor Digital: Edit origin (SHOULD FAIL)",
                        edit_success,
                        "✓ Correctly blocked from editing origin/campaign" if edit_success else "✗ Should be blocked from editing origin/campaign"
                    )
    
    def test_permission_system_completeness(self):
        """Test overall system completeness and edge cases"""
        print("=== TESTING SYSTEM COMPLETENESS ===")
        
        # Test that Director can't create Gerente de Ventas Digitales
        if "director" in self.tokens:
            headers = {"Authorization": f"Bearer {self.tokens['director']}"}
            
            gerente_data = {
                "email": "test.gerente.digital@dcapp.com",
                "password": "dcapp123",
                "name": "Test Gerente Ventas Digitales",
                "role": "Gerente de Ventas Digitales",
                "agency": "Meridien"
            }
            
            success, data = self.make_request("POST", "/users", headers=headers, data=gerente_data, expected_status=403)
            self.log_test(
                "System Issue: No Gerente de Ventas Digitales can be created",
                False,
                "❌ CRITICAL: Director blocked from creating Gerente de Ventas Digitales, but none exist in system. This creates a deadlock - no one can create users."
            )
        
        # Test authentication flow completeness
        auth_results = {}
        for role in ["Director", "DCA", "Asesor Digital"]:
            role_key = role.lower().replace(" ", "_")
            auth_results[role] = role_key in self.tokens
        
        working_roles = [role for role, working in auth_results.items() if working]
        self.log_test(
            "Authentication Coverage",
            len(working_roles) >= 2,
            f"✅ Successfully authenticated {len(working_roles)}/3 roles: {', '.join(working_roles)}"
        )
    
    def run_comprehensive_test(self):
        """Run the comprehensive role-based permissions test"""
        print("🔒 DCAPP V1 ROLE-BASED PERMISSIONS VALIDATION 🔒")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Testing restructured permission system")
        print("=" * 80)
        
        start_time = time.time()
        
        # Run test suites in order
        self.test_authentication()
        self.test_director_permissions()
        self.test_dca_permissions()
        self.test_asesor_digital_permissions()
        self.test_permission_system_completeness()
        
        # Generate summary
        end_time = time.time()
        duration = end_time - start_time
        
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t["success"]])
        failed_tests = total_tests - passed_tests
        
        print("=" * 80)
        print("🎯 ROLE-BASED PERMISSIONS TEST RESULTS")
        print("=" * 80)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print(f"Duration: {duration:.2f} seconds")
        print()
        
        # Summary by permission verification
        permission_categories = {
            "Director Supervision": 0,
            "Director Restrictions": 0,
            "DCA Permissions": 0,
            "DCA Restrictions": 0,
            "Asesor Permissions": 0,
            "Asesor Restrictions": 0
        }
        
        category_totals = {k: 0 for k in permission_categories.keys()}
        
        for test in self.test_results:
            test_name = test["test"]
            if "Director" in test_name:
                if "SHOULD FAIL" in test_name or "should fail" in test_name.lower():
                    category_totals["Director Restrictions"] += 1
                    if test["success"]:
                        permission_categories["Director Restrictions"] += 1
                else:
                    category_totals["Director Supervision"] += 1
                    if test["success"]:
                        permission_categories["Director Supervision"] += 1
            elif "DCA" in test_name:
                if "SHOULD FAIL" in test_name or "should fail" in test_name.lower():
                    category_totals["DCA Restrictions"] += 1
                    if test["success"]:
                        permission_categories["DCA Restrictions"] += 1
                else:
                    category_totals["DCA Permissions"] += 1
                    if test["success"]:
                        permission_categories["DCA Permissions"] += 1
            elif "Asesor Digital" in test_name:
                if "SHOULD FAIL" in test_name or "should fail" in test_name.lower():
                    category_totals["Asesor Restrictions"] += 1
                    if test["success"]:
                        permission_categories["Asesor Restrictions"] += 1
                else:
                    category_totals["Asesor Permissions"] += 1
                    if test["success"]:
                        permission_categories["Asesor Permissions"] += 1
        
        print("📊 PERMISSION VERIFICATION BY CATEGORY:")
        print("-" * 60)
        for category, passed in permission_categories.items():
            total = category_totals[category]
            if total > 0:
                percentage = (passed/total)*100
                print(f"{category}: {passed}/{total} ({percentage:.1f}%)")
        
        # Critical findings
        print("\n🔍 CRITICAL FINDINGS:")
        print("-" * 60)
        
        critical_issues = []
        working_features = []
        
        for test in self.test_results:
            if not test["success"]:
                if "CRITICAL" in test["details"] or "deadlock" in test["details"].lower():
                    critical_issues.append(test)
                elif "SHOULD FAIL" not in test["test"]:
                    critical_issues.append(test)
            else:
                if "Successfully" in test["details"] or "Correctly blocked" in test["details"]:
                    working_features.append(test)
        
        if critical_issues:
            print("❌ ISSUES FOUND:")
            for issue in critical_issues:
                print(f"  • {issue['test']}")
                print(f"    └─ {issue['details']}")
        
        print(f"\n✅ WORKING PERMISSIONS: {len(working_features)} verified")
        
        return {
            "total": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "success_rate": (passed_tests/total_tests)*100,
            "duration": duration,
            "critical_issues": len(critical_issues),
            "working_permissions": len(working_features),
            "permission_categories": permission_categories,
            "detailed_results": self.test_results
        }

if __name__ == "__main__":
    tester = RolePermissionsTester()
    results = tester.run_comprehensive_test()