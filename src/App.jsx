import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import RequirePermission from './components/admin/RequirePermission'
import Login from './components/admin/auth/Login'
import Signup from './components/admin/auth/Signup'
import Dashboard from './components/admin/pages/Dashboard'
import Layout from './components/admin/Layout'
import Notifications from './components/admin/pages/Notification'
import VendorManagement from './components/admin/pages/VendorManagement'
import Farmers from './components/admin/pages/FarmerManagement'
import AddFarmer from './components/admin/pages/AddFarmer'
import EditFarmer from './components/admin/pages/EditFarmer'
import FarmerDetails from './components/admin/pages/FarmerDetails'
import FarmerIndividualOrderHistory from './components/admin/pages/FarmerIndividualOrderHistory'
import FarmerOrderDetails from './components/admin/pages/FarmerOrderDetails'
import FarmerPayout from './components/admin/pages/FarmerPayout'
import VegetableAvailability from './components/admin/pages/VegetableAvailability'
import VegetableHistory from './components/admin/pages/VegetableHistory'
import VendorDetails from './components/admin/pages/VendorDetails'
import AddVendorForm from './components/admin/pages/AddVendor'
import EditVendorDetails from './components/admin/pages/EditVendor'
import SupplierDashboard from './components/admin/pages/SupplierManagement'
import AddSupplierForm from './components/admin/pages/AddSupplier'
import SupplierDetails from './components/admin/pages/SupplierDetails'
import EditSupplier from './components/admin/pages/EditSupplier'
import SupplierIndividualOrderHistory from './components/admin/pages/SupplierIndividualOrderHistory'
import SupplierPayout from './components/admin/pages/SupplierPayout'
import ThirdPartyManagement from './components/admin/pages/ThirdPartyManagement'
import AddThirdParty from './components/admin/pages/AddThirdParty'
import EditThirdParty from './components/admin/pages/EditThirdParty'
import ThirdPartyDetails from './components/admin/pages/ThirdPartyDetails'
import ThirdPartyIndividualOrderHistory from './components/admin/pages/ThirdPartyIndividualOrderHistory'
import ThirdPartyPayout from './components/admin/pages/ThirdPartyPayout'
import DriverManagement from './components/admin/pages/DriverManagement'
import AddDriver from './components/admin/pages/AddDriver'
import EditDriver from './components/admin/pages/EditDriver'
import DriverDetails from './components/admin/pages/DriverDetails'
import DriverAirportDelivery from './components/admin/pages/DriverAirportDelivery'
import DriverLocalPickups from './components/admin/pages/DriverLocalPickups'
import DriverFlowerOrder from './components/admin/pages/DriverFlowerOrder'
import AddFuelExpenses from './components/admin/pages/AddFuelExpenses'
import AddExcessKM from './components/admin/pages/AddExcessKM'
import EditExcessKM from './components/admin/pages/EditExcessKM'
import ViewExcessKM from './components/admin/pages/ViewExcessKM'
import AddAdvancePay from './components/admin/pages/AddAdvancePay'
import FuelExpenseManagement from './components/admin/pages/FuelExpenseManagement'
import ViewFuelExpense from './components/admin/pages/ViewFuelExpense'
import EditFuelExpense from './components/admin/pages/EditFuelExpense'
import AdvancePayManagement from './components/admin/pages/AdvancePayManagement'
import ViewAdvancePay from './components/admin/pages/ViewAdvancePay'
import EditAdvancePay from './components/admin/pages/EditAdvancePay'
import RemarksManagement from './components/admin/pages/RemarksManagement'
import AddRemarks from './components/admin/pages/AddRemarks'
import ViewRemarks from './components/admin/pages/ViewRemarks'
import EditRemarks from './components/admin/pages/EditRemarks'
import DailyPayout from './components/admin/pages/DailyPayout'
import PayoutManagement from './components/admin/pages/PayoutManagement'
import PayoutSupplier from './components/admin/pages/PayoutSupplier'
import PayoutThirdParty from './components/admin/pages/PayoutThirdParty'
import PayoutLabour from './components/admin/pages/PayoutLabour'
import PayoutDriver from './components/admin/pages/PayoutDriver'
import RolesPermissionSystem from './components/admin/pages/RolesAndPermissionsManagements'
import LabourManagement from './components/admin/pages/LabourManagement'
import LabourAdd from './components/admin/pages/LabourAdd'
import LabourEdit from './components/admin/pages/LabourEdit'
import LabourDetails from './components/admin/pages/LabourDetails'
import LabourDailyWorks from './components/admin/pages/LabourDailyWorks'
import LabourAttendance from './components/admin/pages/LabourAttendance'
import LabourAttendanceEdit from './components/admin/pages/LabourAttendanceEdit'
import LabourDailyPayout from './components/admin/pages/LabourDailyPayout'
import LabourExcessPayManagement from './components/admin/pages/LabourExcessPayManagement'
import AddLabourExcessPay from './components/admin/pages/AddLabourExcessPay'
import EditLabourExcessPay from './components/admin/pages/EditLabourExcessPay'
import LabourRemarksManagement from './components/admin/pages/LabourRemarksManagement'
import LabourRemarkAdd from './components/admin/pages/LabourRemarkAdd'
import LabourRemarkEdit from './components/admin/pages/LabourRemarkEdit'
import DriveAttendance from './components/admin/pages/DriveAttendance'
import AttendanceEdit from './components/admin/pages/AttendanceEdit'
import ReportManagement from './components/admin/pages/ReportManagement'
import ReportFarmer from './components/admin/pages/ReportFarmer'
import ReportSupplier from './components/admin/pages/ReportSupplier'
import ReportThirdParty from './components/admin/pages/ReportThirdParty'
import ReportLabour from './components/admin/pages/ReportLabour'
import ReportInvoice from './components/admin/pages/ReportInvoice'
import ReportInvoiceCumPackingList from './components/admin/pages/ReportInvoiceCumPackingList'
import InvoiceCumPackingListDetail from './components/admin/pages/InvoiceCumPackingListDetail'
import ReportPayout from './components/admin/pages/ReportPayout'
import ReportOrder from './components/admin/pages/ReportOrder'
import ReportFlowerOrder from './components/admin/pages/ReportFlowerOrder'
import ReportFlowerOrderView from './components/admin/pages/ReportFlowerOrderView'
import ReportDriver from './components/admin/pages/ReportDriver'
import ReportDriverView from './components/admin/pages/ReportDriverView'
import ReportOrderView from './components/admin/pages/ReportOrderView'
import ReportAirport from './components/admin/pages/ReportAirport'
import ReportAirportView from './components/admin/pages/ReportAirportView'
import ReportFarmerView from './components/admin/pages/ReportFarmerView'
import ReportFarmerOrderView from './components/admin/pages/ReportFarmerOrderView'
import ReportSupplierView from './components/admin/pages/ReportSupplierView'
import ReportSupplierOrderView from './components/admin/pages/ReportSupplierOrderView'
import ReportThirdPartyView from './components/admin/pages/ReportThirdPartyView'
import ReportThirdPartyOrderView from './components/admin/pages/ReportThirdPartyOrderView'
import AddProduct from './components/admin/pages/AddProduct'
import OrderManagementList from './components/admin/pages/OrderManagement'
import OrderCreate from './components/admin/pages/OrderCreate'
import OrderView from './components/admin/pages/OrderView'
import PreOrder from './components/admin/pages/PreOrder'
import OrderAssignManagement from './components/admin/pages/OrderAssignManagement'
import OrderAssignCreateStage1 from './components/admin/pages/OrderAssignCreateStage1'
import OrderAssignCreateStage2 from './components/admin/pages/OrderAssignCreateStage2'
import OrderAssignCreateStage3 from './components/admin/pages/OrderAssignCreateStage3'
import OrderAssignCreateStage4 from './components/admin/pages/OrderAssignCreateStage4'
import FlowerOrderAssignStage1 from './components/admin/pages/FlowerOrderAssignStage1'
import FlowerOrderAssignStage2 from './components/admin/pages/FlowerOrderAssignStage2'
import FlowerOrderAssignStage3 from './components/admin/pages/FlowerOrderAssignStage3'
import FlowerOrderAssignStage4 from './components/admin/pages/FlowerOrderAssignStage4'
import OrderAssignEdit from './components/admin/pages/OrderAssignEdit'
import LocalOrderAssign from './components/admin/pages/LocalOrderAssign'
import StockManagement from './components/admin/pages/StockManagement'
import StockReassignmentForm from './components/admin/pages/StockReassignmentForm'
import PackingInventory from './components/admin/pages/PackingInventory'
import PayoutFormulas from './components/admin/pages/PayoutFormulas'
import Airport from './components/admin/pages/Airport'
import AddInventory from './components/admin/pages/AddInventory'
import EditInventory from './components/admin/pages/EditInventory'
import PetrolBunkManagement from './components/admin/pages/PetrolBunkManagement'
import LabourRateManagement from './components/admin/pages/LabourRateManagement'
import DriverRateManagement from './components/admin/pages/DriverRateManagement'
import InventoryCompany from './components/admin/pages/InventoryCompany'
import AddCustomers from './components/admin/pages/AddCustomers'
import StartEndKMManagement from './components/admin/pages/StartEndKMManagement'

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Dashboard">
                  <Dashboard />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendors"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Vendors" action="view">
                  <VendorManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendors/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Vendors" action="view">
                  <VendorDetails />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendors/add"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Vendors" action="add">
                  <AddVendorForm />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendors/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Vendors" action="edit">
                  <EditVendorDetails />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmers"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Farmers" action="view">
                  <Farmers />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmers/add"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Farmers" action="add">
                  <AddFarmer />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmers/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Farmers" action="edit">
                  <EditFarmer />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmers/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Farmers" action="view">
                  <FarmerDetails />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmers/:id/orders"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Farmers" action="orderlist">
                  <FarmerIndividualOrderHistory />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmers/:id/orders/:orderId"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Farmers" action="orderlist">
                  <OrderView />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmers/:id/order-details"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Farmers" action="orderlist">
                  <FarmerOrderDetails />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmers/:id/payout"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Farmers" action="payout">
                  <FarmerPayout />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmers/:id/vegetable-availability"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Farmers" action="vegetableavailability">
                  <VegetableAvailability />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmers/:id/vegetable-history"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Farmers" action="vegetableavailability">
                  <VegetableHistory />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Suppliers" action="view">
                  <SupplierDashboard />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers/add"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Suppliers" action="add">
                  <AddSupplierForm />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Suppliers" action="edit">
                  <EditSupplier />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Suppliers" action="view">
                  <SupplierDetails />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers/:id/orders"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Suppliers" action="orderlist">
                  <SupplierIndividualOrderHistory />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers/:id/payout"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Suppliers" action="payout">
                  <SupplierPayout />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/third-party"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Third Party" action="view">
                  <ThirdPartyManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/third-party/add"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Third Party" action="add">
                  <AddThirdParty />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/third-party/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Third Party" action="edit">
                  <EditThirdParty />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/third-party/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Third Party" action="view">
                  <ThirdPartyDetails />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/third-party/:id/orders"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Third Party" action="orderlist">
                  <ThirdPartyIndividualOrderHistory />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/third-party/:id/payout"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Third Party" action="payout">
                  <ThirdPartyPayout />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="view">
                  <DriverManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers/add"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="add">
                  <AddDriver />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="edit">
                  <EditDriver />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="view">
                  <DriverDetails />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers/:id/local-pickups"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="localgradeorder">
                  <DriverLocalPickups />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers/:id/airport"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="boxorder">
                  <DriverAirportDelivery />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers/:id/flower-orders"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="flowerorder">
                  <DriverFlowerOrder />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers/:id/fuel-expenses"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="fuelexpense">
                  <AddFuelExpenses />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers/:id/excess-km"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers">
                  <AddExcessKM />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers/:id/advance-pay"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="advancepay">
                  <AddAdvancePay />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/fuel-expense-management"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="fuelexpense">
                  <FuelExpenseManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/fuel-expenses/view/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="fuelexpense">
                  <ViewFuelExpense />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/fuel-expenses/edit/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="fuelexpense">
                  <EditFuelExpense />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/start-end-km-management"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="startkm_endkm">
                  <StartEndKMManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/excess-km/view/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="startkm_endkm">
                  <ViewExcessKM />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/excess-km/edit/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="startkm_endkm">
                  <EditExcessKM />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/advance-pay-management"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="advancepay">
                  <AdvancePayManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/advance-pay/view/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="advancepay">
                  <ViewAdvancePay />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/advance-pay/edit/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="advancepay">
                  <EditAdvancePay />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/remarks-management"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="remarks">
                  <RemarksManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers/:id/remarks"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="remarks">
                  <AddRemarks />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/remarks/view/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="remarks">
                  <ViewRemarks />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/remarks/edit/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="remarks">
                  <EditRemarks />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers/:id/daily-payout"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="dailypayout">
                  <DailyPayout />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers/attendance"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="attendance">
                  <DriveAttendance />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers/attendance/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Drivers" action="attendance_edit">
                  <AttendanceEdit />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="view">
                  <LabourManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/add"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="add">
                  <LabourAdd />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="edit">
                  <LabourEdit />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/attendance"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="attendance">
                  <LabourAttendance />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/attendance/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="attendance_edit">
                  <LabourAttendanceEdit />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/excess-pay"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="excesspay">
                  <LabourExcessPayManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/excess-pay/add"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="excesspay">
                  <AddLabourExcessPay />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/excess-pay/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="excesspay">
                  <EditLabourExcessPay />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="view">
                  <LabourDetails />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/:id/daily-works"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="attendance">
                  <LabourDailyWorks />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/daily-payout"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="dailypayout">
                  <LabourDailyPayout />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/:id/daily-payout"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="dailypayout">
                  <LabourDailyPayout />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/:id/labour-remarks"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="view">
                  <LabourRemarksManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/:id/labour-remarks/add"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="view">
                  <LabourRemarkAdd />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/labour/:id/labour-remarks/edit/:remarkId"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Labour" action="view">
                  <LabourRemarkEdit />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/add"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Add Product" action="add">
                  <AddProduct />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Orders" action="view">
                  <OrderManagementList />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/create"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Orders" action="add">
                  <OrderCreate />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Orders" action="view">
                  <OrderView />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/preorders/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Orders" action="view">
                  <PreOrder />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/drafts/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Orders" action="view">
                  <OrderView />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-assign"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Order Assign" action="view">
                  <OrderAssignManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-assign/stage1/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Order Assign" action="add">
                  <OrderAssignCreateStage1 />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-assign/stage2/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Order Assign" action="add">
                  <OrderAssignCreateStage2 />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-assign/stage3/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Order Assign" action="add">
                  <OrderAssignCreateStage3 />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-assign/stage4/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Order Assign" action="add">
                  <OrderAssignCreateStage4 />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-assign/flower/stage1/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Order Assign" action="add">
                  <FlowerOrderAssignStage1 />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-assign/flower/stage2/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Order Assign" action="add">
                  <FlowerOrderAssignStage2 />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-assign/flower/stage3/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Order Assign" action="add">
                  <FlowerOrderAssignStage3 />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-assign/flower/stage4/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Order Assign" action="add">
                  <FlowerOrderAssignStage4 />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-assign/edit/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Order Assign" action="edit">
                  <OrderAssignEdit />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-assign/local/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Order Assign" action="edit">
                  <LocalOrderAssign />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stock"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Stock Management" action="view">
                  <StockManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stock/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Stock Management" action="edit">
                  <StockReassignmentForm />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payouts"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Payouts">
                  <PayoutManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payout-supplier"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Payouts" action="supplierpayout">
                  <PayoutSupplier />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payout-thirdparty"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Payouts" action="thirdpartypayout">
                  <PayoutThirdParty />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payout-labour"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Payouts" action="labourpayout">
                  <PayoutLabour />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payout-driver"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Payouts" action="driverpayout">
                  <PayoutDriver />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports">
                  <ReportManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/farmer"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="farmerreports">
                  <ReportFarmer />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/supplier"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="supplierreports">
                  <ReportSupplier />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/third-party"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="thirdpartyreports">
                  <ReportThirdParty />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/labour"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="labourreports">
                  <ReportLabour />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/invoice"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="invoicereports">
                  <ReportInvoice />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/invoice-cum-packing-list"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="invoicereports">
                  <ReportInvoiceCumPackingList />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/invoice-cum-packing-list/:orderId"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="invoicereports">
                  <InvoiceCumPackingListDetail />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/payout"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="payoutreports">
                  <ReportPayout />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/order"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="orderreports">
                  <ReportOrder />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/flower-order"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="flowerorderreports">
                  <ReportFlowerOrder />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/flower-order/:orderId"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="flowerorderreports">
                  <ReportFlowerOrderView />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/airport"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports">
                  <ReportAirport />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/airport/:orderId"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports">
                  <ReportAirportView />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/driver"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="driverreports">
                  <ReportDriver />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/driver/:driverId"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="driverreports">
                  <ReportDriverView />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/report-order/:orderId"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="orderreports">
                  <ReportOrderView />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/report-farmer/:farmerId"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="farmerreports">
                  <ReportFarmerView />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/report-farmer/:farmerId/order/:orderId"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="farmerreports">
                  <ReportFarmerOrderView />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/report-supplier/:supplierId"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="supplierreports">
                  <ReportSupplierView />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/report-supplier/:supplierId/order/:orderId"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="supplierreports">
                  <ReportSupplierOrderView />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/report-third-party/:thirdPartyId"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="thirdpartyreports">
                  <ReportThirdPartyView />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/report-third-party/:thirdPartyId/order/:orderId"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Reports" action="thirdpartyreports">
                  <ReportThirdPartyOrderView />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="/roles" element={<ProtectedRoute><Layout><RolesPermissionSystem /></Layout></ProtectedRoute>} />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Notification">
                  <Notifications />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Settings" action="inventorymanagement">
                  <PackingInventory />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/inventory-company"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Settings" action="inventorycompany">
                  <InventoryCompany />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/createinventory"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Settings" action="inventorymanagement">
                  <AddInventory />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/editinventory"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Settings" action="inventorymanagement">
                  <EditInventory />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/airport"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Settings" action="airportlocation">
                  <Airport />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/payout-formulas"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Settings">
                  <PayoutFormulas />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/petroleum"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Settings" action="petroleummanagement">
                  <PetrolBunkManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/labour-rate"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Settings" action="labourrate">
                  <LabourRateManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/driver-rate"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Settings" action="driverrate">
                  <DriverRateManagement />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/customers"
          element={
            <ProtectedRoute>
              <Layout>
                <RequirePermission module="Settings" action="customer">
                  <AddCustomers />
                </RequirePermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={localStorage.getItem('authToken') ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}

export default App