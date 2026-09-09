import { configuredOAuthProviders } from "@/lib/oauth";
import { LoginClient } from "./LoginClient";

export default function LoginPage() {
  return <LoginClient providers={configuredOAuthProviders()} />;
}
