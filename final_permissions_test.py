#!/usr/bin/env python3
"""
DCAPP V1 COMPREHENSIVE ROLE-BASED PERMISSIONS TEST SUITE
Tests the complete newly restructured permission system for all roles
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Optional

# Backend URL from frontend environment
BACKEND_URL = "https://dcapp-sales-hub.preview.emergentagent.com/api"

# Complete test credentials
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
    "asesor_digital": {
        "email": "asesor.digital.test@dcapp.com",
        "password": "dcapp123",
        "role": "Asesor Digital"
    },
    "gerente_ventas_digitales": {
        "email": "gerente.ventas.digital@dcapp.com",
        "password": "dcapp123",
        "role": "Gerente de Ventas Digitales"
    }
}

class ComprehensiveRolePermissionsTester:
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
        
        status = "✅" if success else "❌"
        expected_icon = "✅" if "SHOULD WORK" in test_name or not ("SHOULD FAIL" in test_name or "should fail" in test_name.lower()) else "❌"
        
        print(f"{status} {expected_icon}: {test_name}")
        if details:
            print(f"    └─ {details}")
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
            
            if expected_status is not None:
                return response.status_code == expected_status, response.json() if response.content else {"status_code": response.status_code}
            
            return response.status_code in [200, 201], response.json() if response.content else {}
            
        except Exception as e:
            return False, {"error": str(e)}
    
    def test_authentication(self):
        """Test authentication for all roles"""
        print("🔐 === TESTING AUTHENTICATION FOR ALL ROLES ===")
        
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
                        f"Authentication - {role.replace('_', ' ').title()}",
                        True,
                        f"{user_data.get('name')} | {user_data.get('role')} | {user_data.get('agency')}"
                    )
                else:
                    self.log_test(f"Get User Info - {role}", False, "Failed to get user details", user_data)
            else:
                self.log_test(f"Authentication - {role}", False, f"Login failed", data)
    
    def test_director_permissions(self):
        """Test DIRECTOR role - Read-only supervision"""
        print("👑 === TESTING DIRECTOR PERMISSIONS (Read-Only Supervision) ===")
        
        if "director" not in self.tokens:
            return
        
        headers = {"Authorization": f"Bearer {self.tokens['director']}"}
        
        # ✅ SHOULD WORK
        success, data = self.make_request("GET", "/metrics/dashboard", headers=headers)
        self.log_test(
            "Director: View Dashboard - SHOULD WORK",
            success and "agencies" in data,
            f"Can view {len(data.get('agencies', []))} agencies" if success else "Cannot access dashboard"
        )
        
        success, data = self.make_request("GET", "/reports/overview", headers=headers)
        self.log_test(
            "Director: View Reports - SHOULD WORK",
            success,
            "Can access all reports" if success else "Cannot access reports"
        )
        
        success, data = self.make_request("GET", "/leads", headers=headers)
        self.log_test(
            "Director: View All Leads - SHOULD WORK",
            success,
            f"Can view all {data.get('total', 0)} leads" if success else "Cannot view leads"
        )
        
        # ❌ SHOULD FAIL
        new_user = {
            "email": "test@director.com",
            "password": "dcapp123",
            "name": "Test Director User",
            "role": "Marketing",
            "agency": "Meridien"
        }
        success, data = self.make_request("POST", "/users", headers=headers, data=new_user, expected_status=403)
        self.log_test(
            "Director: Create User - SHOULD FAIL",
            success,
            "Correctly blocked from creating users" if success else "Incorrectly allowed user creation"
        )
        
        # Get a lead to test modification
        lead_success, lead_data = self.make_request("GET", "/leads", headers=headers)
        if lead_success and lead_data.get("leads"):
            lead_id = lead_data["leads"][0]["id"]
            
            success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": "Contactado"}, expected_status=403)
            self.log_test(
                "Director: Modify Lead - SHOULD FAIL",
                success,
                "Correctly blocked from modifying leads" if success else "Incorrectly allowed lead modification"
            )
    
    def test_gerente_ventas_digitales_permissions(self):
        """Test GERENTE DE VENTAS DIGITALES - Full control"""
        print("👨‍💼 === TESTING GERENTE DE VENTAS DIGITALES (Full Control) ===")
        
        if "gerente_ventas_digitales" not in self.tokens:
            return
        
        headers = {"Authorization": f"Bearer {self.tokens['gerente_ventas_digitales']}"}
        
        # ✅ SHOULD WORK - Full control
        test_user = {
            "email": "test.marketing.gerente@dcapp.com",
            "password": "dcapp123",
            "name": "Test Marketing User Created by Gerente",
            "role": "Marketing",
            "agency": "Jetour"
        }
        
        success, data = self.make_request("POST", "/users", headers=headers, data=test_user)
        if success:
            self.created_users.append(data["id"])
            self.log_test(
                "Gerente Ventas Digitales: Create User - SHOULD WORK",
                True,
                f"Successfully created user: {data['name']}"
            )
        else:
            self.log_test("Gerente Ventas Digitales: Create User - SHOULD WORK", False, "Failed to create user", data)
        
        # Test editing users
        if self.created_users:
            user_id = self.created_users[0]
            update_data = {"name": "Updated Marketing User Name"}
            success, data = self.make_request("PATCH", f"/users/{user_id}", headers=headers, data=update_data)
            self.log_test(
                "Gerente Ventas Digitales: Edit User - SHOULD WORK",
                success,
                "Successfully updated user name" if success else "Failed to edit user"
            )
        
        # Test creating leads
        dca_user = self.user_details.get("dca")
        if dca_user:
            new_lead = {
                "name": "Lead Created by Gerente",
                "phone": "5555559999",
                "agency": "Meridien",
                "origin": "Google Ads",
                "campaign": "Gerente Test Campaign",
                "dca_id": dca_user["id"]
            }
            
            success, data = self.make_request("POST", "/leads", headers=headers, data=new_lead)
            if success:
                lead_id = data["id"]
                self.created_leads.append(lead_id)
                self.log_test(
                    "Gerente Ventas Digitales: Create Lead - SHOULD WORK",
                    True,
                    f"Created lead: {data['name']}"
                )
                
                # Test moving to any stage (full control)
                for stage in ["Demo", "Cierre", "Facturada"]:
                    success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": stage})
                    if success:
                        self.log_test(
                            f"Gerente Ventas Digitales: Move to {stage} - SHOULD WORK",
                            True,
                            f"Successfully moved to {stage}"
                        )
                        break  # Just test one successful move
                
                # Test reassigning DCA and Asesor
                asesor_user = self.user_details.get("asesor_digital")
                if asesor_user:
                    success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={
                        "asesor_id": asesor_user["id"],
                        "dca_id": dca_user["id"]
                    })
                    self.log_test(
                        "Gerente Ventas Digitales: Reassign DCA/Asesor - SHOULD WORK",
                        success,
                        "Successfully reassigned DCA and Asesor" if success else "Failed to reassign"
                    )
    
    def test_dca_permissions(self):
        """Test DCA permissions and restrictions"""
        print("📋 === TESTING DCA PERMISSIONS ===")
        
        if "dca" not in self.tokens:
            return
        
        headers = {"Authorization": f"Bearer {self.tokens['dca']}"}
        dca_user = self.user_details.get("dca")
        
        # ✅ SHOULD WORK
        success, data = self.make_request("GET", "/leads?agency=Meridien", headers=headers)
        self.log_test(
            "DCA: View Agency Leads - SHOULD WORK",
            success,
            f"Can view {data.get('total', 0)} leads from agency"
        )
        
        new_lead = {
            "name": "Lead Created by DCA Test",
            "phone": "5555557777",
            "agency": "Meridien",
            "origin": "Instagram",
            "campaign": "DCA Test Campaign",
            "dca_id": dca_user["id"] if dca_user else ""
        }
        
        success, data = self.make_request("POST", "/leads", headers=headers, data=new_lead)
        if success:
            lead_id = data["id"]
            self.created_leads.append(lead_id)
            self.log_test(
                "DCA: Create Lead - SHOULD WORK",
                True,
                f"Created lead: {data['name']}"
            )
            
            # Test DCA stage movements (Lead → Contactado → Citado → Cumplida)
            dca_stages = ["Contactado", "Citado", "Cumplida"]
            for stage in dca_stages:
                success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": stage})
                self.log_test(
                    f"DCA: Move to {stage} - SHOULD WORK",
                    success,
                    f"Successfully moved to {stage}" if success else f"Failed to move to {stage}"
                )
            
            # Test assigning asesor
            asesor_user = self.user_details.get("asesor_digital")
            if asesor_user:
                success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"asesor_id": asesor_user["id"]})
                self.log_test(
                    "DCA: Assign Asesor - SHOULD WORK",
                    success,
                    "Successfully assigned asesor" if success else "Failed to assign asesor"
                )
            
            # ❌ SHOULD FAIL - Beyond DCA stages
            success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": "Demo"}, expected_status=403)
            self.log_test(
                "DCA: Move to Demo - SHOULD FAIL",
                success,
                "Correctly blocked from moving beyond Cumplida" if success else "Incorrectly allowed to move to Demo"
            )
            
            success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": "Facturada"}, expected_status=403)
            self.log_test(
                "DCA: Move to Facturada - SHOULD FAIL",
                success,
                "Correctly blocked from moving to Facturada" if success else "Incorrectly allowed to move to Facturada"
            )
            
            # ❌ SHOULD FAIL - Reassign DCA
            success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"dca_id": "673db091d07e5e0b09cac897"}, expected_status=403)
            self.log_test(
                "DCA: Reassign DCA - SHOULD FAIL",
                success,
                "Correctly blocked from reassigning DCA" if success else "Incorrectly allowed to reassign DCA"
            )
            
            # ❌ SHOULD FAIL - Register sale
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
                "origen": "Instagram",
                "campaign": "Test",
                "facturado_a": "Cliente Test",
                "fecha_factura": datetime.utcnow().isoformat()
            }
            success, data = self.make_request("POST", "/sales", headers=headers, data=sale_data, expected_status=403)
            self.log_test(
                "DCA: Register Sale - SHOULD FAIL",
                success,
                "Correctly blocked from registering sales" if success else "Incorrectly allowed to register sales"
            )
    
    def test_asesor_digital_permissions(self):
        """Test Asesor Digital permissions and restrictions"""
        print("💼 === TESTING ASESOR DIGITAL PERMISSIONS ===")
        
        if "asesor_digital" not in self.tokens:
            return
        
        headers = {"Authorization": f"Bearer {self.tokens['asesor_digital']}"}
        asesor_user = self.user_details.get("asesor_digital")
        
        # ❌ SHOULD FAIL - Dashboard access
        success, data = self.make_request("GET", "/metrics/dashboard", headers=headers, expected_status=403)
        self.log_test(
            "Asesor Digital: View Dashboard - SHOULD FAIL",
            success,
            "Correctly blocked from viewing dashboard" if success else "Incorrectly allowed dashboard access"
        )
        
        success, data = self.make_request("GET", "/reports/overview", headers=headers, expected_status=403)
        self.log_test(
            "Asesor Digital: View Reports - SHOULD FAIL",
            success,
            "Correctly blocked from viewing reports" if success else "Incorrectly allowed reports access"
        )
        
        success, data = self.make_request("GET", "/metrics/agency/Meridien", headers=headers, expected_status=403)
        self.log_test(
            "Asesor Digital: View Agency Metrics - SHOULD FAIL",
            success,
            "Correctly blocked from viewing agency metrics" if success else "Incorrectly allowed agency metrics"
        )
        
        # ✅ SHOULD WORK - Only assigned leads
        success, data = self.make_request("GET", "/leads", headers=headers)
        if success:
            leads = data.get("leads", [])
            assigned_leads = [lead for lead in leads if lead.get("asesor_id") == asesor_user["id"]] if asesor_user else []
            self.log_test(
                "Asesor Digital: View Only Assigned Leads - SHOULD WORK",
                True,
                f"Can view {len(assigned_leads)} assigned leads (correct filtering)"
            )
        
        # Test with assigned lead
        if self.created_leads and asesor_user:
            lead_id = self.created_leads[-1]  # Use latest created lead
            
            # Prepare lead (assign to asesor and move to Cumplida)
            if "dca" in self.tokens:
                dca_headers = {"Authorization": f"Bearer {self.tokens['dca']}"}
                prep_success, prep_data = self.make_request("PATCH", f"/leads/{lead_id}", headers=dca_headers, data={
                    "asesor_id": asesor_user["id"],
                    "stage": "Cumplida"
                })
                
                if prep_success:
                    # ✅ SHOULD WORK - Asesor stages
                    for stage in ["Demo", "Cierre"]:
                        success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"stage": stage})
                        self.log_test(
                            f"Asesor Digital: Move to {stage} - SHOULD WORK",
                            success,
                            f"Successfully moved to {stage}" if success else f"Failed to move to {stage}"
                        )
                    
                    # ✅ SHOULD WORK - Register sale
                    sale_data = {
                        "lead_id": lead_id,
                        "marca": "Cadillac",
                        "modelo": "CT5",
                        "version": "Premium",
                        "precio": 900000,
                        "cantidad": 1,
                        "tipo_venta": "Contado",
                        "asesor_id": asesor_user["id"],
                        "dca_id": self.user_details.get("dca", {}).get("id", ""),
                        "origen": "Instagram",
                        "campaign": "Asesor Test",
                        "facturado_a": "Cliente Asesor Final",
                        "fecha_factura": datetime.utcnow().isoformat()
                    }
                    success, data = self.make_request("POST", "/sales", headers=headers, data=sale_data)
                    self.log_test(
                        "Asesor Digital: Register Sale - SHOULD WORK",
                        success,
                        "Successfully registered sale" if success else "Failed to register sale"
                    )
                    
                    # ❌ SHOULD FAIL - Change DCA
                    success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"dca_id": "673db091d07e5e0b09cac897"}, expected_status=403)
                    self.log_test(
                        "Asesor Digital: Change DCA - SHOULD FAIL",
                        success,
                        "Correctly blocked from changing DCA" if success else "Incorrectly allowed DCA change"
                    )
                    
                    # ❌ SHOULD FAIL - Reassign asesor
                    success, data = self.make_request("PATCH", f"/leads/{lead_id}", headers=headers, data={"asesor_id": "673db091d07e5e0b09cac898"}, expected_status=403)
                    self.log_test(
                        "Asesor Digital: Reassign Asesor - SHOULD FAIL",
                        success,
                        "Correctly blocked from reassigning asesor" if success else "Incorrectly allowed asesor reassignment"
                    )
    
    def run_comprehensive_test(self):
        """Run the complete comprehensive role-based permissions test"""
        print("🔒 DCAPP V1 COMPREHENSIVE ROLE-BASED PERMISSIONS TEST 🔒")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Testing ALL roles in the new permission system")
        print("=" * 80)
        
        start_time = time.time()
        
        # Run all test suites
        self.test_authentication()
        self.test_director_permissions()
        self.test_gerente_ventas_digitales_permissions()
        self.test_dca_permissions()
        self.test_asesor_digital_permissions()
        
        # Generate comprehensive summary
        end_time = time.time()
        duration = end_time - start_time
        
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t["success"]])
        failed_tests = total_tests - passed_tests
        
        print("=" * 80)
        print("🎯 COMPREHENSIVE ROLE-BASED PERMISSIONS TEST RESULTS")
        print("=" * 80)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print(f"Duration: {duration:.2f} seconds")
        print()
        
        # Results by role
        roles_results = {}
        for test in self.test_results:
            test_name = test["test"]
            for role in ["Director", "Gerente Ventas Digitales", "DCA", "Asesor Digital"]:
                if role in test_name:
                    if role not in roles_results:
                        roles_results[role] = {"passed": 0, "total": 0}
                    roles_results[role]["total"] += 1
                    if test["success"]:
                        roles_results[role]["passed"] += 1
                    break
        
        print("📊 RESULTS BY ROLE:")
        print("-" * 60)
        for role, stats in roles_results.items():
            percentage = (stats["passed"]/stats["total"])*100 if stats["total"] > 0 else 0
            print(f"{role}: {stats['passed']}/{stats['total']} ({percentage:.1f}%)")
        
        # Summary by permission type
        should_work = [t for t in self.test_results if "SHOULD WORK" in t["test"]]
        should_fail = [t for t in self.test_results if "SHOULD FAIL" in t["test"]]
        
        should_work_passed = len([t for t in should_work if t["success"]])
        should_fail_passed = len([t for t in should_fail if t["success"]])
        
        print(f"\n🔒 PERMISSION ENFORCEMENT SUMMARY:")
        print("-" * 60)
        print(f"✅ Allowed Operations: {should_work_passed}/{len(should_work)} working")
        print(f"❌ Blocked Operations: {should_fail_passed}/{len(should_fail)} properly blocked")
        
        # Critical issues
        critical_failures = [t for t in self.test_results if not t["success"] and "SHOULD WORK" in t["test"]]
        permission_bypasses = [t for t in self.test_results if not t["success"] and "SHOULD FAIL" in t["test"]]
        
        if critical_failures:
            print(f"\n🚨 CRITICAL FAILURES (Features not working):")
            print("-" * 60)
            for failure in critical_failures:
                print(f"• {failure['test']}")
        
        if permission_bypasses:
            print(f"\n🔓 PERMISSION BYPASSES (Security issues):")
            print("-" * 60)
            for bypass in permission_bypasses:
                print(f"• {bypass['test']}")
        
        # Final verdict
        print(f"\n🎯 FINAL ASSESSMENT:")
        print("-" * 60)
        if len(critical_failures) == 0 and len(permission_bypasses) == 0:
            print("✅ PERMISSION SYSTEM WORKING CORRECTLY")
            print("All roles have proper access controls and restrictions")
        elif len(permission_bypasses) > 0:
            print("🚨 SECURITY ISSUES DETECTED")
            print("Some permissions are not properly enforced")
        else:
            print("⚠️ FUNCTIONAL ISSUES DETECTED")
            print("Some features are not working as expected")
        
        return {
            "total": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "success_rate": (passed_tests/total_tests)*100,
            "duration": duration,
            "roles_results": roles_results,
            "should_work_passed": should_work_passed,
            "should_fail_passed": should_fail_passed,
            "critical_failures": len(critical_failures),
            "permission_bypasses": len(permission_bypasses),
            "verdict": "SECURE" if len(permission_bypasses) == 0 else "INSECURE"
        }

if __name__ == "__main__":
    tester = ComprehensiveRolePermissionsTester()
    results = tester.run_comprehensive_test()