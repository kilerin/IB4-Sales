import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-secret-32chars-minimum-for-jwt' : undefined),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        login: { label: 'Логин', type: 'text' },
        password: { label: 'Пароль', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) return null;
        const rows = await query<{ id: number; password_hash: string }>(
          "SELECT id, password_hash FROM users WHERE email = $1",
          [String(credentials.login).trim()]
        );
        const user = rows[0];
        if (!user || !(await bcrypt.compare(String(credentials.password), user.password_hash))) {
          return null;
        }
        return { id: String(user.id), email: String(credentials.login) };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.id = user.id;
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) (session.user as { id?: string }).id = token.id as string;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
