/**
 * /auth — legacy redirect.
 * The admin login lives at /admin/login.
 * Any bookmark or old link to /auth redirects there.
 */
import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  component: AuthRedirect,
});

function AuthRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/admin/login", replace: true });
  }, [navigate]);
  return null;
}
