import { lazyPage } from "@/lib/lazy-page";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

const Home = lazyPage(() => import("./pages/Home"));
const ForFacilities = lazyPage(() => import("./pages/ForFacilities"));
const CareAtHome = lazyPage(() => import("./pages/CareAtHome"));
const ClinicalHomeCare = lazyPage(() => import("./pages/ClinicalHomeCare"));
const PostSurgicalCare = lazyPage(() => import("./pages/PostSurgicalCare"));
const CareFromAbroad = lazyPage(() => import("./pages/CareFromAbroad"));
const AgencyVsPrivateNurse = lazyPage(() => import("./pages/AgencyVsPrivateNurse"));
const GovernedSeoPage = lazyPage(() => import("./pages/GovernedSeoPage"));
import { GENERATED_PAGE_PATHS } from "./content/seo/governed-pages";
const ExpansionSeoPage = lazyPage(() => import("./pages/ExpansionSeoPage"));
import { EXPANSION_PAGE_PATHS } from "./content/seo/expansion-pages";
import { EXPANSION_REDIRECTS } from "./content/seo/index-policy";
const NeighbourhoodCare = lazyPage(() => import("./pages/NeighbourhoodCare"));

const AntenatalCare = lazyPage(() => import("./pages/AntenatalCare"));
const PostnatalCare = lazyPage(() => import("./pages/PostnatalCare"));
const NannyChildcare = lazyPage(() => import("./pages/NannyChildcare"));
const Eldercare = lazyPage(() => import("./pages/Eldercare"));
const PediatricCare = lazyPage(() => import("./pages/PediatricCare"));
const HospitalStaffing = lazyPage(() => import("./pages/HospitalStaffing"));
const HospitalSupport = lazyPage(() => import("./pages/HospitalSupport"));
const ClinicalResearch = lazyPage(() => import("./pages/ClinicalResearch"));
const MedicAbout = lazyPage(() => import("./pages/MedicAbout"));
const MedicContact = lazyPage(() => import("./pages/MedicContact"));
const JoinRoutePicker = lazyPage(() => import("./pages/portal/JoinRoutePicker"));
const JoinAccount = lazyPage(() => import("./pages/portal/JoinAccount"));
const ClaimStart = lazyPage(() => import("./pages/portal/ClaimStart"));
const CampaignDownload = lazyPage(() => import("./pages/CampaignDownload"));

const PortalVerify = lazyPage(() => import("./pages/portal/PortalVerify"));
const PortalStart = lazyPage(() => import("./pages/portal/PortalStart"));

const Auth = lazyPage(() => import("./pages/Auth"));
const Creator = lazyPage(() => import("./pages/Creator"));
const Blog = lazyPage(() => import("./pages/Blog"));
const BlogPost = lazyPage(() => import("./pages/BlogPost"));
const BlogShortLink = lazyPage(() => import("./pages/BlogShortLink"));
const Matchmakers = lazyPage(() => import("./pages/Matchmakers"));

/** The accessibility panel and live chat shown on every Medic Connect page. */
const MedicConnectWidgets = () => {
  return (
    <>
      <AccessibilityPanel />
      <LiveChatButton />
    </>
  );
};
const MatchmakerOpportunity = lazyPage(() => import("./pages/MatchmakerOpportunity"));
const MatchmakerApply = lazyPage(() => import("./pages/MatchmakerApply"));
const MatchmakerTemplates = lazyPage(() => import("./pages/admin/MatchmakerTemplates"));
const Workforce = lazyPage(() => import("./pages/admin/Workforce"));
const WorkforceStaff = lazyPage(() => import("./pages/admin/WorkforceStaff"));
const MyProfile = lazyPage(() => import("./pages/admin/MyProfile"));
const MatchUniverse = lazyPage(() => import("./pages/admin/MatchUniverse"));
const MatchUniverseOpportunities = lazyPage(() => import("./pages/admin/MatchUniverseOpportunities"));
const MatchUniverseOpportunity = lazyPage(() => import("./pages/admin/MatchUniverseOpportunity"));
const MatchUniversePerson = lazyPage(() => import("./pages/admin/MatchUniversePerson"));
const MatchUniverseMerges = lazyPage(() => import("./pages/admin/MatchUniverseMerges"));
const MatchUniverseVerification = lazyPage(() => import("./pages/admin/MatchUniverseVerification"));
const MatchUniverseIntake = lazyPage(() => import("./pages/admin/MatchUniverseIntake"));
const MatchUniverseAvailability = lazyPage(() => import("./pages/admin/MatchUniverseAvailability"));
const MatchUniverseRequests = lazyPage(() => import("./pages/admin/MatchUniverseRequests"));
const MatchUniverseRequest = lazyPage(() => import("./pages/admin/MatchUniverseRequest"));



const AdminLayout = lazyPage(() => import("./pages/admin/AdminLayout"));
const Dashboard = lazyPage(() => import("./pages/admin/Dashboard"));
const Intelligence = lazyPage(() => import("./pages/admin/Intelligence"));
const AlertKeys = lazyPage(() => import("./pages/admin/AlertKeys"));
const PostsList = lazyPage(() => import("./pages/admin/PostsList"));
const Seo = lazyPage(() => import("./pages/admin/Seo"));
const SeoPageRecord = lazyPage(() => import("./pages/admin/SeoPageRecord"));
const PostEditor = lazyPage(() => import("./pages/admin/PostEditor"));
const Campaigns = lazyPage(() => import("./pages/admin/Campaigns"));
const CampaignEditor = lazyPage(() => import("./pages/admin/CampaignEditor"));
const Audience = lazyPage(() => import("./pages/admin/Audience"));
const Enquiries = lazyPage(() => import("./pages/admin/Enquiries"));
const EnquirySetup = lazyPage(() => import("./pages/admin/EnquirySetup"));
const Applications = lazyPage(() => import("./pages/admin/Applications"));
const EmailTemplates = lazyPage(() => import("./pages/admin/EmailTemplates"));
const CreatorApplications = lazyPage(() => import("./pages/admin/CreatorApplications"));
const AdminSettings = lazyPage(() => import("./pages/admin/Settings"));
const ControlCentre = lazyPage(() => import("./pages/admin/ControlCentre"));
const Approvals = lazyPage(() => import("./pages/admin/Approvals"));
const Invoices = lazyPage(() => import("./pages/admin/Invoices"));
const SetPassword = lazyPage(() => import("./pages/SetPassword"));
const ContractSign = lazyPage(() => import("./pages/ContractSign"));
const ContractEditor = lazyPage(() => import("./pages/admin/ContractEditor"));
const ContractsRegister = lazyPage(() => import("./pages/admin/ContractsRegister"));
const ContractTemplates = lazyPage(() => import("./pages/admin/ContractTemplates"));
const ContractTemplateEditor = lazyPage(() => import("./pages/admin/ContractTemplateEditor"));
const AnnexLibrary = lazyPage(() => import("./pages/admin/AnnexLibrary"));
const Clients = lazyPage(() => import("./pages/admin/Clients"));
const ClientRecord = lazyPage(() => import("./pages/admin/ClientRecord"));
const CareDuplicates = lazyPage(() => import("./pages/admin/CareDuplicates"));

const PortalLogin = lazyPage(() => import("./pages/portal/PortalLogin"));
const PortalSetPassword = lazyPage(() => import("./pages/portal/PortalSetPassword"));
const PortalAccount = lazyPage(() => import("./pages/portal/PortalAccount"));
const WorkforceMode = lazyPage(() => import("./pages/portal/WorkforceMode"));
const PortalDocuments = lazyPage(() => import("./pages/portal/PortalDocuments"));
const PortalAvailability = lazyPage(() => import("./pages/portal/PortalAvailability"));
const PortalPreferences = lazyPage(() => import("./pages/portal/PortalPreferences"));
const PortalOffers = lazyPage(() => import("./pages/portal/PortalOffers"));
const AssessorHome = lazyPage(() => import("./pages/assessor/AssessorHome"));
import AssessorRoute from "./components/assessor/AssessorRoute";
const AssessmentWorkspace = lazyPage(() => import("./pages/assessor/AssessmentWorkspace"));
const PortalContract = lazyPage(() => import("./pages/portal/PortalContract"));
const PortalContractDoc = lazyPage(() => import("./pages/portal/PortalContractDoc"));

const PortalApplications = lazyPage(() => import("./pages/portal/PortalApplications"));
const PortalDetails = lazyPage(() => import("./pages/portal/PortalDetails"));

const Privacy = lazyPage(() => import("./pages/Privacy"));
const Terms = lazyPage(() => import("./pages/Terms"));
const PreAssessment = lazyPage(() => import("./pages/PreAssessment"));
const CareOnboarding = lazyPage(() => import("./pages/CareOnboarding"));
const CareProposalView = lazyPage(() => import("./pages/care/CareProposalView"));
const CareOffer = lazyPage(() => import("./pages/care/CareOffer"));
const CareInvitation = lazyPage(() => import("./pages/care/CareInvitation"));
const CareHome = lazyPage(() => import("./pages/care/CareHome"));

const Unsubscribe = lazyPage(() => import("./pages/Unsubscribe"));
const NotFound = lazyPage(() => import("./pages/NotFound"));
const AdminNotFound = lazyPage(() => import("./pages/admin/AdminNotFound"));
import LiveChatButton from "./components/LiveChatButton";
import AccessibilityPanel from "./components/care/AccessibilityPanel";
import { Analytics } from "./components/Analytics";
import IPhoneScreenEdges from "./components/IPhoneScreenEdges";
import ScrollToTop from "./components/ScrollToTop";

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
      <BrowserRouter future={{ v7_startTransition: true }}>
        <ScrollToTop />
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
            <Route path="/b/:code" element={<BlogShortLink />} />
            <Route path="/hm" element={<Matchmakers />} />
            <Route path="/hm/:slug" element={<MatchmakerOpportunity />} />
            <Route path="/hm/:slug/apply" element={<MatchmakerApply />} />
            <Route path="/care/start/:token" element={<CareOnboarding />} />
            <Route path="/pre-assessment/:token" element={<PreAssessment />} />
            <Route path="/care/proposal" element={<CareProposalView />} />
            <Route path="/care/offer/:token" element={<CareOffer />} />
            <Route path="/o/:token" element={<CareOffer />} />
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
              <Route path="match-universe/not-signed-in" element={<MatchUniverse scope="unclaimed" />} />
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
