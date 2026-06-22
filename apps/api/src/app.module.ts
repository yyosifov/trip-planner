import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggingMiddleware } from './common/logging.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { TripsModule } from './trips/trips.module';
import { IntakeModule } from './intake/intake.module';
import { ResearchModule } from './research/research.module';
import { PlacesModule } from './places/places.module';
import { ItineraryModule } from './itinerary/itinerary.module';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    TripsModule,
    IntakeModule,
    ResearchModule,
    PlacesModule,
    ItineraryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
