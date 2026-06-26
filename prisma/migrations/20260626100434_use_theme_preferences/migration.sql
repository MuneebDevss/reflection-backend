-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('light', 'dark');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "theme" "Theme" NOT NULL DEFAULT 'light';

-- CreateTable
CREATE TABLE "oauth_clients" (
    "id" UUID NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_hash" TEXT,
    "client_name" TEXT,
    "redirect_uris" TEXT[],
    "grant_types" TEXT[],
    "scopes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_auth_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "scopes" TEXT[],
    "code_challenge" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_access_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "refresh_hash" TEXT,
    "client_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "scopes" TEXT[],
    "expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_clients_client_id_key" ON "oauth_clients"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_auth_codes_code_key" ON "oauth_auth_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_access_tokens_token_hash_key" ON "oauth_access_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_access_tokens_refresh_hash_key" ON "oauth_access_tokens"("refresh_hash");

-- AddForeignKey
ALTER TABLE "oauth_auth_codes" ADD CONSTRAINT "oauth_auth_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_auth_codes" ADD CONSTRAINT "oauth_auth_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
