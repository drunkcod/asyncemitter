import { AsyncEmitter } from './AsyncEmitter.js';
import { describe, expect, it, jest } from '@jest/globals';

describe('AsyncEmitter', () => {
	it('should register an event listener with "on" and emit an event with "emit"', async () => {
		const emitter = new AsyncEmitter<{ test(x: string, y: string): void }>();
		const listener = jest.fn((x: string, y: string) => {});
		emitter.on('test', listener);
		await emitter.emitAsync('test', 'arg1', 'arg2');
		expect(listener).toHaveBeenCalledWith('arg1', 'arg2');
	});

	it('should call multiple listeners for the same event', async () => {
		const emitter = new AsyncEmitter<{ test(value: string): void }>();
		const listener1 = jest.fn((arg: string) => {});
		const listener2 = jest.fn((arg: string) => {});
		emitter.on('test', listener1);
		emitter.on('test', listener2);
		await emitter.emitAsync('test', 'arg');
		expect(listener1).toHaveBeenCalledWith('arg');
		expect(listener2).toHaveBeenCalledWith('arg');
	});

	it('should not call listeners for other events', async () => {
		const emitter = new AsyncEmitter<{ test(): void; 'other-event'(): void }>();
		const listener = jest.fn(() => {});
		emitter.on('test', listener);
		await emitter.emitAsync('other-event');
		expect(listener).not.toHaveBeenCalled();
	});

	it('should handle events with no listeners', async () => {
		const emitter = new AsyncEmitter();
		await expect(emitter.emitAsync('test')).resolves.not.toThrow();
	});

	it('should maintain the correct "this" context in listeners', async () => {
		const emitter = new AsyncEmitter();
		let context: any;
		const listener = function (this: AsyncEmitter) {
			context = this;
		};
		emitter.on('test', listener);
		await emitter.emitAsync('test');
		expect(context).toBe(emitter);
	});

	it('should await asynchronous listeners', async () => {
		const emitter = new AsyncEmitter();
		let asyncListenerCalled = false;
		const asyncListener = () => {
			return new Promise<void>((resolve) => {
				setTimeout(() => {
					asyncListenerCalled = true;
					resolve();
				}, 50);
			});
		};
		emitter.on('test', asyncListener);
		await emitter.emitAsync('test');
		expect(asyncListenerCalled).toBe(true);
	});

	it('emits error on error', async () => {
		const emitter = new AsyncEmitter();
		let onErrorCalled = false;
		emitter.on('error', (err) => {
			onErrorCalled = true;
		});

		emitter.on('hello', () => {
			throw new Error();
		});

		await emitter.emitAsync('hello');

		expect(onErrorCalled).toBeTruthy();
	});

	it('emits error for each of multiple errors', async () => {
		const emitter = new AsyncEmitter();
		const errors: unknown[] = [];
		emitter.on('error', ({ listener, reason }) => {
			errors.push(reason);
		});

		const firstError = new Error(),
			secondError = new Error();
		emitter.on('hello', () => {
			throw firstError;
		});

		emitter.on('hello', () => {
			throw secondError;
		});

		await emitter.emitAsync('hello');

		expect(errors).toContainEqual(firstError);
		expect(errors).toContainEqual(secondError);
	});

	it('emits error for each rejected promise', async () => {
		const emitter = new AsyncEmitter();
		const errors: unknown[] = [];
		emitter.on('error', ({ listener, reason }) => {
			errors.push(reason);
		});

		const firstError = new Error(),
			secondError = new Error();
		emitter.on('hello', () => Promise.reject(firstError));

		emitter.on('hello', () => Promise.reject(secondError));

		await emitter.emitAsync('hello');

		expect(errors).toContainEqual(firstError);
		expect(errors).toContainEqual(secondError);
	});

	it('handles error during error', async () => {
		let errorError: unknown = null;
		const emitter = new AsyncEmitter();
		emitter.onUnhandledError = (error) => {
			errorError = error;
		};

		emitter.on('error', (err) => {
			throw new Error('error Error');
		});

		emitter.on('event', () => Promise.reject(new Error('event Error')));

		await emitter.emitAsync('event');

		expect(errorError).not.toBeNull();
	});

	it('reports unhandled errors', async () => {
		let errorError: unknown = null;
		const emitter = new AsyncEmitter();
		emitter.onUnhandledError = (error) => {
			errorError = error;
		};

		emitter.on('event', () => Promise.reject(new Error('event Error')));

		await emitter.emitAsync('event');

		expect(errorError).not.toBeNull();
	});
});
