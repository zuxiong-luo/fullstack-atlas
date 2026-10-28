import 'reflect-metadata';
import {
 Body, ConflictException, Controller, HttpCode, Injectable, Module,
 Post, UnprocessableEntityException, ValidationPipe,
} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {IsIn, IsInt, Max, Min} from 'class-validator';

export class QuoteInput {
 @IsInt() @Min(1) @Max(120)
 seconds!: number;

 @IsIn(['standard', 'hd'])
 quality: 'standard' | 'hd' = 'standard';
}

export class HdDurationExceeded extends Error {}

@Injectable()
export class PricingService {
 quote(seconds: number, quality: 'standard' | 'hd') {
  if (quality === 'hd' && seconds > 60) {
   throw new HdDurationExceeded('HD报价最多支持60秒');
  }
  const rate = quality === 'hd' ? 4 : 2;
  return {seconds, quality, credits: seconds * rate, internal_rule: 'demo-rate-v1'};
 }
}

@Controller('api/quotes')
export class QuotesController {
 constructor(private readonly pricing: PricingService) {}

 @Post() @HttpCode(200)
 create(@Body() body: QuoteInput) {
  try {
   const {seconds, quality, credits} = this.pricing.quote(body.seconds, body.quality);
   return {seconds, quality, credits};
  } catch (error) {
   if (error instanceof HdDurationExceeded) {
    throw new ConflictException({detail: {code: 'HD_LIMIT', message: error.message}});
   }
   throw error;
  }
 }
}

@Module({controllers: [QuotesController], providers: [PricingService]})
class AppModule {}

export async function createApp() {
 const app = await NestFactory.create(AppModule, {logger: false});
 app.useGlobalPipes(new ValidationPipe({
  transform: true,
  transformOptions: {enableImplicitConversion: false},
  whitelist: true,
  forbidNonWhitelisted: true,
  exceptionFactory: () => new UnprocessableEntityException({code: 'INPUT_INVALID'}),
 }));
 return app;
}

if (require.main === module) {
 void (async () => {
  const app = await createApp();
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4196), '127.0.0.1');
  console.log(JSON.stringify({event: 'listening', port: app.getHttpServer().address().port}));
 })();
}
