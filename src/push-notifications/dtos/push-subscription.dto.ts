import { IsString } from 'class-validator';

export class PushSubscriptionDto {
    @IsString({ message: 'Endpoint must be a string' })
    endpoint: string;

    @IsString({ message: 'Public key must be a string' })
    p256dhKey: string;

    @IsString({ message: 'Auth secret must be a string' })
    authKey: string;
}