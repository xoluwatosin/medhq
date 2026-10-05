// A wrong admin address stays inside the admin shell, with the way back.
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

const AdminNotFound = () => {
  const { pathname } = useLocation();
  return (
    <div className="mx-auto max-w-[520px] py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Not found</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">There is no admin page at this address.</h1>
      <p className="mt-3 break-all text-sm text-muted-foreground">{pathname}</p>
      <Button asChild className="mt-6">
        <Link to="/admin">Back to the overview</Link>
      </Button>
    </div>
  );
};

export default AdminNotFound;
