import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { databaseUrl } from "./config";
export async function failInitialization() {
  const url = new URL(databaseUrl());
  url.username = "missing_fixture_role";
  @Module({
    imports: [
      TypeOrmModule.forRoot({
        type: "postgres",
        url: url.toString(),
        retryAttempts: 1,
        extra: { connectionTimeoutMillis: 500 },
      }),
    ],
  })
  class BrokenDatabaseModule {}
  return NestFactory.create(BrokenDatabaseModule, {
    logger: false,
    abortOnError: false,
  });
}
