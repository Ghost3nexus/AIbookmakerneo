// Fix: Manually define types for process.env to resolve TypeScript errors.
// This is necessary because the default vite/client reference was failing
// and to provide types for process.env.API_KEY as required by the guidelines.
declare const process: {
  env: {
    API_KEY: string;
  };
};
