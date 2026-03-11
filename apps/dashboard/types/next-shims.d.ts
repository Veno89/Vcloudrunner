declare module 'next/server' {
  export type NextRequest = Request & {
    nextUrl: URL;
  };
}

declare module 'next/cache' {
  export function revalidatePath(path: string): void;
}

declare module 'next/navigation' {
  export function redirect(path: string): never;
  export function useRouter(): {
    refresh: () => void;
  };
}
