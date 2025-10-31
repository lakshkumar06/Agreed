declare module '*.json' {
  const value: any;
  export default value;
}

declare module '@coral-xyz/anchor' {
  export namespace Program {
    interface AccountNamespace<IDL> {
      contract: any;
    }
  }
}

