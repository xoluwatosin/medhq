import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import Home from "./pages/Home";
import ForFacilities from "./pages/ForFacilities";
import CareAtHome from "./pages/CareAtHome";
import ClinicalHomeCare from "./pages/ClinicalHomeCare";
import PostSurgicalCare from "./pages/PostSurgicalCare";
import CareFromAbroad from "./pages/CareFromAbroad";
import AgencyVsPrivateNurse from "./pages/AgencyVsPrivateNurse";
import GovernedSeoPage from "./pages/GovernedSeoPage";
import { GENERATED_PAGE_PATHS } from "./content/seo/governed-pages";
import ExpansionSeoPage from "./pages/ExpansionSeoPage";
import { EXPANSION_PAGE_PATHS } from "./content/seo/expansion-pages";
import { EXPANSION_REDIRECTS } from "./content/seo/index-policy";
import NeighbourhoodCare from "./pages/NeighbourhoodCare";

import AntenatalCare from "./pages/AntenatalCare";
import PostnatalCare from "./pages/PostnatalCare";
import NannyChildcare from "./pages/NannyChildcare";
import Eldercare from "./pages/Eldercare";
import PediatricCare from "./pages/PediatricCare";
import HospitalStaffing from "./pages/HospitalStaffing";
import HospitalSupport from "./pages/HospitalSupport";
import ClinicalResearch from "./pages/ClinicalResearch";
import MedicAbout from "./pages/MedicAbout";
import MedicContact from "./pages/MedicContact";
import JoinRoutePicker from "./pages/portal/JoinRoutePicker";
import JoinAccount from "./pages/portal/JoinAccount";
import ClaimStart from "./pages/portal/ClaimStart";
import CampaignDownload from "./pages/CampaignDownload";

import PortalVerify from "./pages/portal/PortalVerify";
import PortalStart from "./pages/portal/PortalStart";

import Auth from "./pages/Auth";
import Creator from "./pages/Creator";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Matchmakers from "./pages/Matchmakers";

/** The accessibility panel and live chat shown on every Medic Connect page. */
const MedicConnectWidgets = () => {
  return (
    <>
      <AccessibilityPanel />
      <LiveChatButton />
    </>
  );
};
import MatchmakerOpportunity from "./pages/MatchmakerOpportunity";
import MatchmakerApply from "./pages/MatchmakerApply";
import MatchmakerTemplates from "./pages/admin/MatchmakerTemplates";
import Workforce from "./pages/admin/Workforce";
import WorkforceStaff from "./pages/admin/WorkforceStaff";
import MyProfile from "./pages/admin/MyProfile";
import MatchUniverse from "./pages/admin/MatchUniverse";
import MatchUniverseOpportunities from "./pages/admin/MatchUniverseOpportunities";
import MatchUniverseOpportunity from "./pages/admin/MatchUniverseOpportunity";
import MatchUniversePerson from "./pages/admin/MatchUniversePerson";
import MatchUniverseMerges from "./pages/admin/MatchUniverseMerges";
import MatchUniverseVerification from "./pages/admin/MatchUniverseVerification";
import MatchUniverseIntake from "./pages/admin/MatchUniverseIntake";
import MatchUniverseAvailability from "./pages/admin/MatchUniverseAvailability";
import MatchUniverseRequests from "./pages/admin/MatchUniverseRequests";
import MatchUniverseRequest from "./pages/admin/MatchUniverseRequest";



import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Intelligence from "./pages/admin/Intelligence";
import AlertKeys from "./pages/admin/AlertKeys";
import PostsList from "./pages/admin/PostsList";
import Seo from "./pages/admin/Seo";
import SeoPageRecord from "./pages/admin/SeoPageRecord";
import PostEditor from "./pages/admin/PostEditor";
import Campaigns from "./pages/admin/Campaigns";
import CampaignEditor from "./pages/admin/CampaignEditor";
import Audience from "./pages/admin/Audience";
import Enquiries from "./pages/admin/Enquiries";
import EnquirySetup from "./pages/admin/EnquirySetup";
import Applications from "./pages/admin/Applications";
import EmailTemplates from "./pages/admin/EmailTemplates";
import CreatorApplications from "./pages/admin/CreatorApplications";
import AdminSettings from "./pages/admin/Settings";
import ControlCentre from "./pages/admin/ControlCentre";
import Approvals from "./pages/admin/Approvals";
import Invoices from "./pages/admin/Invoices";
import SetPassword from "./pages/SetPassword";
import ContractSign from "./pages/ContractSign";
import ContractEditor from "./pages/admin/ContractEditor";
import ContractsRegister from "./pages/admin/ContractsRegister";
import ContractTemplates from "./pages/admin/ContractTemplates";
import ContractTemplateEditor from "./pages/admin/ContractTemplateEditor";
import AnnexLibrary from "./pages/admin/AnnexLibrary";
import Clients from "./pages/admin/Clients";
import ClientRecord from "./pages/admin/ClientRecord";
import CareDuplicates from "./pages/admin/CareDuplicates";

import PortalLogin from "./pages/portal/PortalLogin";
import PortalSetPassword from "./pages/portal/PortalSetPassword";
import PortalAccount from "./pages/portal/PortalAccount";
import WorkforceMode from "./pages/portal/WorkforceMode";
import PortalDocuments from "./pages/portal/PortalDocuments";
import PortalAvailability from "./pages/portal/PortalAvailability";
import PortalPreferences from "./pages/portal/PortalPreferences";
import PortalOffers from "./pages/portal/PortalOffers";
import AssessorHome from "./pages/assessor/AssessorHome";
import AssessorRoute from "./components/assessor/AssessorRoute";
import AssessmentWorkspace from "./pages/assessor/AssessmentWorkspace";
import PortalContract from "./pages/portal/PortalContract";
import PortalContractDoc from "./pages/portal/PortalContractDoc";

import PortalApplications from "./pages/portal/PortalApplications";
import PortalDetails from "./pages/portal/PortalDetails";

import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import PreAssessment from "./pages/PreAssessment";
import CareOnboarding from "./pages/CareOnboarding";
import CareProposalView from "./pages/care/CareProposalView";
import CareInvitation from "./pages/care/CareInvitation";
import CareHome from "./pages/care/CareHome";

import Unsubscribe from "./pages/Unsubscribe";
import NotFound from "./pages/NotFound";
import AdminNotFound from "./pages/admin/AdminNotFound";
import LiveChatButton from "./components/LiveChatButton";
import AccessibilityPanel from "./components/care/AccessibilityPanel";
import { Analytics } from "./components/Analytics";
import IPhoneScreenEdges from "./components/IPhoneScreenEdges";

const queryClient = new QueryClient();

function MatchmakerRedirect() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const rest = location.pathname.replace(`/admin/matchmakers/${id}`, "");
  const target = `/admin/match-universe/opportunities/${id}${rest}`;
  return <Navigate to={target} replace />;
}

function JoinTrackRedirect() {
  const { route } = useParams<{ route: string }>();
  return <Navigate to={`/join/${route}/account`} replace />;
}

const App = () => (

  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <IPhoneScreenEdges />
        <Analytics />
        <AuthProvider>
          <div className="mc-a11y-public">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/for-facilities" element={<ForFacilities />} />
            <Route path="/care-at-home" element={<CareAtHome />} />
            <Route path="/clinical-home-care" element={<ClinicalHomeCare />} />
            <Route path="/post-surgical-care" element={<PostSurgicalCare />} />
            <Route path="/care-from-abroad" element={<CareFromAbroad />} />
            <Route path="/agency-vs-private-nurse-lagos" element={<AgencyVsPrivateNurse />} />
            {/* Governed SEO pages — composed from approved modules and public fees.
                Listed explicitly so crawlers can statically discover each route. */}
            {GENERATED_PAGE_PATHS.map((path) => (
              <Route key={path} path={path} element={<GovernedSeoPage />} />
            ))}
            {/* Expansion SEO pages — distinct routes using the established service-page design. */}
            {EXPANSION_PAGE_PATHS.map((path) => (
              <Route key={path} path={path} element={<ExpansionSeoPage />} />
            ))}
            {/* Routes merged into the established page that owns the topic. */}
            {Object.entries(EXPANSION_REDIRECTS).map(([from, to]) => (
              <Route key={from} path={from} element={<Navigate to={to} replace />} />
            ))}
            {/* Neighbourhood landing pages — listed explicitly so SEO scanners and crawlers can statically discover each route. */}
            <Route path="/home-care-ikoyi" element={<NeighbourhoodCare slug="ikoyi" />} />
            <Route path="/home-care-lekki" element={<NeighbourhoodCare slug="lekki" />} />
            <Route path="/home-care-victoria-island" element={<NeighbourhoodCare slug="victoria-island" />} />
            <Route path="/home-care-ikeja" element={<NeighbourhoodCare slug="ikeja" />} />
            <Route path="/home-care-ajah" element={<NeighbourhoodCare slug="ajah" />} />
            <Route path="/home-care-surulere" element={<NeighbourhoodCare slug="surulere" />} />
            <Route path="/home-care-yaba" element={<NeighbourhoodCare slug="yaba" />} />
            <Route path="/home-care-banana-island" element={<NeighbourhoodCare slug="banana-island" />} />
            <Route path="/home-care-parkview" element={<NeighbourhoodCare slug="parkview" />} />
            <Route path="/home-care-osborne-foreshore" element={<NeighbourhoodCare slug="osborne-foreshore" />} />
            <Route path="/home-care-eko-atlantic" element={<NeighbourhoodCare slug="eko-atlantic" />} />
            <Route path="/home-care-lekki-phase-1" element={<NeighbourhoodCare slug="lekki-phase-1" />} />
            <Route path="/home-care-vgc" element={<NeighbourhoodCare slug="vgc" />} />
            <Route path="/home-care-ikeja-gra" element={<NeighbourhoodCare slug="ikeja-gra" />} />
            <Route path="/home-care-magodo-gra" element={<NeighbourhoodCare slug="magodo-gra" />} />
            <Route path="/antenatal-care" element={<AntenatalCare />} />
            <Route path="/postnatal-care" element={<PostnatalCare />} />
            <Route path="/nanny-childcare" element={<NannyChildcare />} />
            <Route path="/eldercare" element={<Eldercare />} />
            <Route path="/pediatric-care" element={<PediatricCare />} />
            <Route path="/hospital-staffing" element={<HospitalStaffing />} />
            <Route path="/hospital-support" element={<HospitalSupport />} />
            <Route path="/clinical-research" element={<ClinicalResearch />} />
            <Route path="/about" element={<MedicAbout />} />
            <Route path="/contact" element={<MedicContact />} />
            <Route path="/claim" element={<ClaimStart />} />
            <Route path="/download/:filename" element={<CampaignDownload />} />
            <Route path="/join" element={<JoinRoutePicker />} />

            <Route path="/join/:route" element={<JoinTrackRedirect />} />
            <Route path="/join/:route/account" element={<JoinAccount />} />
            <Route path="/join/:route/verify" element={<PortalVerify />} />

            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/creator" element={<Creator />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/contract/:token" element={<ContractSign />} />
            <Route path="/portal" element={<PortalAccount />} />
            <Route path="/portal/workforce" element={<WorkforceMode />} />
            <Route path="/portal/verify" element={<PortalVerify />} />
            <Route path="/portal/start" element={<PortalStart />} />
            <Route path="/portal/documents" element={<PortalDocuments />} />
            <Route path="/portal/availability" element={<PortalAvailability />} />
            <Route path="/portal/preferences" element={<PortalPreferences />} />
            <Route path="/portal/offers" element={<PortalOffers />} />
            <Route path="/portal/offers/contract/:id" element={<PortalContract />} />
            <Route path="/portal/offers/contract/:id/doc/:code" element={<PortalContractDoc />} />

            <Route path="/portal/applications" element={<PortalApplications />} />
            <Route path="/portal/details" element={<PortalDetails />} />
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal/set-password" element={<PortalSetPassword />} />

            <Route path="/assessor" element={<AssessorRoute><AssessorHome /></AssessorRoute>} />
            <Route path="/assessor/:id" element={<AssessorRoute><AssessmentWorkspace /></AssessorRoute>} />


            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/hm" element={<Matchmakers />} />
            <Route path="/hm/:slug" element={<MatchmakerOpportunity />} />
            <Route path="/hm/:slug/apply" element={<MatchmakerApply />} />
            <Route path="/care/start/:token" element={<CareOnboarding />} />
            <Route path="/pre-assessment/:token" element={<PreAssessment />} />
            <Route path="/care/proposal" element={<CareProposalView />} />
            <Route path="/care/invitation/:token" element={<CareInvitation />} />
            <Route path="/care" element={<CareHome />} />

            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="care/requests" element={<Navigate to="/admin/clients?view=requests" replace />} />
              <Route path="care/duplicates" element={<CareDuplicates />} />
              <Route path="clients" element={<Clients />} />
              <Route path="clients/:id" element={<ClientRecord />} />
              <Route path="intelligence" element={<Intelligence />} />
              <Route path="alert-keys" element={<AlertKeys />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="posts" element={<PostsList />} />
              <Route path="posts/:id" element={<PostEditor />} />
              <Route path="seo" element={<Seo />} />
              <Route path="seo/pages/:id" element={<SeoPageRecord />} />
              <Route path="seo/:section" element={<Seo />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="campaigns/:id" element={<CampaignEditor />} />
              <Route path="audience" element={<Audience />} />
              <Route path="enquiries" element={<Enquiries />} />
              <Route path="enquiries/setup" element={<EnquirySetup />} />
              <Route path="applications" element={<Applications />} />
              {/* Each list has its own Archived view now. */}
              <Route path="archives" element={<Navigate to="/admin/enquiries?view=archived" replace />} />
              <Route path="email-templates" element={<EmailTemplates />} />
              <Route path="creator-applications" element={<CreatorApplications />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="control-centre" element={<ControlCentre />} />
              <Route path="approvals" element={<Approvals />} />
              {/* Match Universe — unified admin workspace for talent pool and opportunities */}
              <Route path="match-universe" element={<MatchUniverse />} />
              <Route path="match-universe/opportunities" element={<MatchUniverseOpportunities />} />
              <Route path="match-universe/opportunities/templates" element={<MatchmakerTemplates />} />
              <Route path="match-universe/opportunities/:id/*" element={<MatchUniverseOpportunity />} />
              <Route path="match-universe/merges" element={<MatchUniverseMerges />} />
              <Route path="match-universe/verification" element={<MatchUniverseVerification />} />
              <Route path="match-universe/intake" element={<MatchUniverseIntake />} />
              <Route path="match-universe/availability" element={<MatchUniverseAvailability />} />
              <Route path="match-universe/requests" element={<MatchUniverseRequests />} />
              <Route path="match-universe/requests/:id" element={<MatchUniverseRequest />} />
              {/* Workforce is the internal staff register: contracts and compliance. */}
              <Route path="me" element={<MyProfile />} />
              <Route path="workforce" element={<Workforce />} />
              <Route path="workforce/:id" element={<WorkforceStaff />} />
              <Route path="contracts" element={<ContractsRegister />} />
              <Route path="contracts/templates" element={<ContractTemplates />} />
              <Route path="contracts/templates/:id" element={<ContractTemplateEditor />} />
              <Route path="contracts/annexes" element={<AnnexLibrary />} />
              <Route path="contracts/:id" element={<ContractEditor />} />

              <Route path="match-universe/workforce" element={<Navigate to="/admin/workforce" replace />} />

              <Route path="match-universe/:id" element={<MatchUniversePerson />} />

              {/* Backwards-compatible redirects for old Healthcare Matchmakers Network admin routes */}
              <Route path="matchmakers" element={<Navigate to="/admin/match-universe/opportunities" replace />} />
              <Route path="matchmakers/templates" element={<Navigate to="/admin/match-universe/opportunities/templates" replace />} />
              <Route path="matchmakers/:id/*" element={<MatchmakerRedirect />} />

              {/* Domain landings. Every historic URL above still resolves; these
                  only give each business domain a front door of its own. */}
              <Route path="programmes" element={<Navigate to="/admin/creator-applications" replace />} />
              <Route path="care" element={<Navigate to="/admin/clients" replace />} />
              <Route path="talent" element={<Navigate to="/admin/match-universe" replace />} />
              <Route path="communications" element={<Navigate to="/admin/campaigns" replace />} />
              <Route path="finance" element={<Navigate to="/admin/invoices" replace />} />
              <Route path="*" element={<AdminNotFound />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </div>
          <MedicConnectWidgets />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
