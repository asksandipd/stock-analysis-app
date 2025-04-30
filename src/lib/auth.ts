import type { NextAuthOptions, Session } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Add your own authentication logic here
        if (credentials?.username === "admin" && credentials?.password === "admin") {
          return {
            id: "1",
            name: "Admin",
            email: "admin@example.com",
          }
        }
        return null
      }
    })
  ],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async session({ session, token }) {
      if (session?.user) {
        (session.user as Session["user"] & { id: string }).id = token.id as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
  }
}