import { Controller, Get, Post, Body, Param, UseGuards, Req, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import {  JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { GetUser } from '@auth/decorators';
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findOne(@GetUser('userId') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateOne(@GetUser('userId') userId: string, @Body() updateUserData: Partial<UpdateUserDto>) {
    return this.usersService.update(userId, updateUserData);
  }
}
