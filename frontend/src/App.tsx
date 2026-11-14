import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AdminLayout, AthleteLayout, MerchantLayout } from "@/components/Layouts";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import SetPassword from "@/pages/SetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import AthleteCard from "@/pages/AthleteCard";
import AthleteConvenzioni from "@/pages/AthleteConvenzioni";
import AthleteMovements from "@/pages/AthleteMovements";
import AthleteFamily from "@/pages/AthleteFamily";
import AthleteProfile from "@/pages/AthleteProfile";
import MerchantCassa from "@/pages/MerchantCassa";
import MerchantHistory from "@/pages/MerchantHistory";
import MerchantProfile from "@/pages/MerchantProfile";
import Admin from "@/pages/Admin";

// keeps toasts above the mobile bottom navigation
const TOAST_MOBILE_OFFSET = { bottom: 88 };

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/imposta-password" element={<SetPassword />} />
        <Route path="/verifica-email" element={<VerifyEmail />} />
        <Route path="/atleta" element={<AthleteLayout />}>
          <Route index element={<AthleteCard />} />
          <Route path="convenzioni" element={<AthleteConvenzioni />} />
          <Route path="famiglia" element={<AthleteFamily />} />
          <Route path="movimenti" element={<AthleteMovements />} />
          <Route path="profilo" element={<AthleteProfile />} />
        </Route>
        <Route path="/commerciante" element={<MerchantLayout />}>
          <Route index element={<MerchantCassa />} />
          <Route path="storico" element={<MerchantHistory />} />
          <Route path="profilo" element={<MerchantProfile />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors mobileOffset={TOAST_MOBILE_OFFSET} />
    </>
  );
}
