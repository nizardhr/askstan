import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import PlanSelection from './pages/PlanSelection';
import PaymentRequired from './pages/PaymentRequired';
import CheckoutSuccess from './pages/CheckoutSuccess';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route 
            path="/checkout-success" 
            element={
              <ProtectedRoute>
                <CheckoutSuccess />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/subscribe" 
            element={
              <ProtectedRoute>
                <PlanSelection />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/payment-required" 
            element={
              <ProtectedRoute>
                <PaymentRequired />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute requireSubscription={true}>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute requireSubscription={true}>
                <Settings />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;