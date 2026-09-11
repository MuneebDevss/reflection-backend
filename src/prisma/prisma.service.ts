// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required to initialize PrismaClient');
    }

    const url = new URL(databaseUrl);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('sslrootcert');

    const ca = readFileSync(join(process.cwd(), 'prisma', 'ca.pem'), 'utf-8');

    super({
      adapter: new PrismaPg({
        connectionString: url.toString(),
        ssl: { ca, rejectUnauthorized: true },
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}