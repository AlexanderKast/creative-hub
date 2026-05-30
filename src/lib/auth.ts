import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";

function getAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email:    { label: "Email",      type: "email"    },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const supabase = getAuthClient();
          const { data, error } = await supabase.auth.signInWithPassword({
            email:    credentials.email,
            password: credentials.password,
          });

          if (error || !data.user) {
            console.error("[auth] signInWithPassword error:", error?.message);
            return null;
          }

          return {
            id:    data.user.id,
            email: data.user.email ?? "",
            name:  (data.user.user_metadata?.name as string) ?? data.user.email ?? "",
          };
        } catch (e) {
          console.error("[auth] authorize threw:", e instanceof Error ? e.message : e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name  = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name  = token.name  as string;
      }
      return session;
    },
  },
  pages: { signIn: "/" },
};

export function getAuth() {
  return getServerSession(authOptions);
}
