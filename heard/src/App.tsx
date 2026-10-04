import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import HeardRoutes from "@/pages/heard/HeardRoutes";
import HeardAdmin from "@/pages/admin/HeardAdmin";

const App = () => (
  <BrowserRouter>
    <Toaster />
    <AuthProvider>
      <Routes>
        <Route path="/admin" element={<HeardAdmin />} />
        <Route path="/*" element={<HeardRoutes base="" />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
