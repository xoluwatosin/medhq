import { Routes, Route, Navigate } from "react-router-dom";
import HeardThanks from "@/pages/HeardThanks";
import { HeardBaseProvider, useHeardPath } from "@/components/heard/HeardBase";
import HeardPlaceholder from "./HeardPlaceholder";
import HeardHome from "./HeardHome";
import HeardWrite from "./HeardWrite";
import HeardStorySwap from "./HeardStorySwap";
import HeardLetterRoom from "./HeardLetterRoom";
import HeardLeaveLetter from "./HeardLeaveLetter";
import HeardTalk from "./HeardTalk";
import HeardAbout from "./HeardAbout";
import HeardSupport from "./HeardSupport";
import HeardPrivacy from "./HeardPrivacy";
import HeardGetInvolved from "./HeardGetInvolved";
import HeardRoleChoice from "./HeardRoleChoice";
import HeardVolunteerPortal from "./HeardVolunteerPortal";
import {
  HeardCreateAccount,
  HeardForgotPassword,
  HeardResetPassword,
  HeardSignIn,
  HeardVerified,
  HeardVerifyEmail,
} from "./HeardVolunteerAuth";

/**
 * The Heard product. One route definition, two mount points:
 *
 *   heard.medicconnect.co/        -> mounted at the root
 *   <other host>/heard-preview    -> mounted under the preview prefix
 *
 * Route paths are relative so the same tree works at either mount. Medic
 * Connect routes are deliberately absent from the Heard hostname.
 */

const HeardHomeRedirect = () => {
  const heardPath = useHeardPath();
  return <Navigate to={heardPath("/")} replace />;
};

const HeardThanksRedirect = () => {
  const heardPath = useHeardPath();
  return <Navigate to={heardPath("/thanks")} replace />;
};

const HeardRoutes = ({ base }: { base?: string }) => (
  <HeardBaseProvider base={base}>
    <Routes>
      <Route path="" element={<HeardHome />} />
      <Route path="heard" element={<HeardHomeRedirect />} />
      <Route path="thanks" element={<HeardThanks />} />
      <Route path="heard/thanks" element={<HeardThanksRedirect />} />

      <Route path="write" element={<HeardWrite />} />
      <Route path="story-swap" element={<HeardStorySwap />} />
      <Route path="letters" element={<HeardLetterRoom />} />
      <Route path="letters/leave" element={<HeardLeaveLetter />} />
      <Route path="talk" element={<HeardTalk />} />
      <Route path="about" element={<HeardAbout />} />
      <Route path="support" element={<HeardSupport />} />
      <Route path="privacy" element={<HeardPrivacy />} />
      <Route path="get-involved" element={<HeardGetInvolved />} />
      <Route path="get-involved/choose-role" element={<HeardRoleChoice />} />
      <Route path="volunteer/create-account" element={<HeardCreateAccount />} />
      <Route path="volunteer/verify-email" element={<HeardVerifyEmail />} />
      <Route path="volunteer/sign-in" element={<HeardSignIn />} />
      <Route path="volunteer/forgot-password" element={<HeardForgotPassword />} />
      <Route path="volunteer/reset-password" element={<HeardResetPassword />} />
      <Route path="volunteer/verified" element={<HeardVerified />} />
      <Route path="volunteer/portal" element={<HeardVolunteerPortal />} />


      <Route
        path="*"
        element={
          <HeardPlaceholder
            path="/"
            title="Page not found — Heard"
            heading="We could not find that page"
            intro="The address may have changed."
          />
        }
      />
    </Routes>
  </HeardBaseProvider>
);

export default HeardRoutes;
