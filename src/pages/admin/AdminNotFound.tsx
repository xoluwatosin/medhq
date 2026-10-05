// A wrong admin address stays inside the admin shell, with the way back.
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MuEmpty, MuPage, MuPageHeader, MuSection } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";

const AdminNotFound = () => {
  const { pathname } = useLocation();
  return (
    <MuPage>
      <MuPageHeader title="Page not found" />
      <MuSection padded={false}>
        <MuEmpty
          art={art.objMagnifier}
          title="Nothing at this address"
          description={pathname}
          action={
            <Button asChild>
              <Link to="/admin">Back to the overview</Link>
            </Button>
          }
        />
      </MuSection>
    </MuPage>
  );
};

export default AdminNotFound;
