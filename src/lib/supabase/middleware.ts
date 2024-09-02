import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function forceLoginWithReturn(request: NextRequest) {
  const originalUrl = new URL(request.url);
  const path = originalUrl.pathname;
  const query = originalUrl.searchParams.toString();
  return NextResponse.redirect(
    new URL(
      `/auth?returnUrl=${encodeURIComponent(
        path + (query ? `?${query}` : "")
      )}`,
      request.url
    )
  );
}

export const validateSession = async (request: NextRequest) => {
  try {
    // Excluir rutas de API
    if (request.nextUrl.pathname.startsWith("/api")) {
      return NextResponse.next();
    }

    let response = NextResponse.next();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: "", ...options });
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const urlParts = request.nextUrl.pathname.split("/");
    const slug = urlParts[1]; // Esto captura el slug dinámico
    const isProtectedRoute =
      slug && slug !== "auth" && slug !== "" && slug !== "public";

    // Redirige si no hay usuario y es una ruta protegida
    if (!user && isProtectedRoute) {
      return forceLoginWithReturn(request);
    }

    return response;
  } catch (e) {
    console.error("Error creating Supabase client:", e);
    return NextResponse.next();
  }
};

export const config = {
  matcher: ["/:slug*"], // Aplicar middleware a todas las rutas dinámicas
};
