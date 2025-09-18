/// <reference types="vite/client" />

// Fix: Augment NodeJS.ProcessEnv to include API_KEY type.
// This resolves the 'Cannot redeclare block-scoped variable "process"' error
// by extending the existing global type definition for `process.env` instead of creating a new one.
// This is the standard and safest way to add environment variable types.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly API_KEY: string;
  }
}
