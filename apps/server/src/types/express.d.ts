// Extend Express Request with userId set by auth middleware
declare namespace Express {
  interface Request {
    userId: string;
  }
}
