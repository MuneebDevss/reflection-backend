import { validate } from 'class-validator';
import { ReschedulingController, RescheduleRequestDto } from './rescheduling.controller';
import { RescheduleStrategy } from './reschedule-strategy.enum';

describe('RescheduleRequestDto', () => {
  it('accepts each supported strategy', async () => {
    for (const strategy of Object.values(RescheduleStrategy)) {
      const errors = await validate(Object.assign(new RescheduleRequestDto(), { strategy }));
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects missing and unsupported strategies', async () => {
    const missing = await validate(new RescheduleRequestDto());
    const unsupported = await validate(
      Object.assign(new RescheduleRequestDto(), { strategy: 'NDF' }),
    );

    expect(missing.length).toBeGreaterThan(0);
    expect(unsupported.length).toBeGreaterThan(0);
  });

  it('rejects an invalid optional date', async () => {
    const errors = await validate(
      Object.assign(new RescheduleRequestDto(), {
        strategy: RescheduleStrategy.FG,
        date: 'not-a-date',
      }),
    );

    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('ReschedulingController', () => {
  it('passes the operation strategy and optional date to the service', async () => {
    const reschedulingService = {
      rescheduleTasks: jest.fn().mockResolvedValue({ success: true }),
    };
    const controller = new ReschedulingController(
      reschedulingService as any,
      {} as any,
    );

    await controller.runRescheduling('user-id', {
      strategy: RescheduleStrategy.HPF,
      date: '2026-10-17',
    });

    expect(reschedulingService.rescheduleTasks).toHaveBeenCalledWith(
      'user-id',
      new Date('2026-10-17'),
      RescheduleStrategy.HPF,
    );
  });
});
