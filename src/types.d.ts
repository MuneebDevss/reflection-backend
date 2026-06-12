export interface AuthenticatedRequest extends Request {
  userId: string; // Adjusted to match your guard's payload assignment
}