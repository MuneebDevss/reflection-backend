-- DropForeignKey
ALTER TABLE "oauth_access_tokens" DROP CONSTRAINT "oauth_access_tokens_client_id_fkey";

-- DropForeignKey
ALTER TABLE "oauth_auth_codes" DROP CONSTRAINT "oauth_auth_codes_client_id_fkey";

-- CreateIndex
CREATE INDEX "oauth_access_tokens_client_id_idx" ON "oauth_access_tokens"("client_id");

-- CreateIndex
CREATE INDEX "oauth_auth_codes_client_id_idx" ON "oauth_auth_codes"("client_id");
