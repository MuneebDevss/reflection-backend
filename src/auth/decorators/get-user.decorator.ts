import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const GetUser = createParamDecorator(
  // 1. 'data' is whatever you pass into the parentheses: @GetUser('userId') -> data = 'userId'
  // 2. 'ctx' gives us access to the underlying Express request object
  (data: string | undefined, ctx: ExecutionContext) => {
    
    // Grab the actual Express request object
    const request = ctx.switchToHttp().getRequest();
    
    // If you typed @GetUser('userId'), 'data' is true.
    // It returns request.user['userId'] safely using optional chaining (?.)
    if (data) {
      return request.user?.[data]; 
    }
    
    // If you just typed @GetUser(), it returns the whole user object
    return request.user;
  },
);