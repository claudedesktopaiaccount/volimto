declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL?: string;
    E2E_DATABASE_URL?: string;
  }
}

export {};
