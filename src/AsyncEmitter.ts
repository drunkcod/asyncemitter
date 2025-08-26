type Listener<TArgs = any> = TArgs extends []
	? (...args: TArgs) => void | Promise<void>
	: (arg: TArgs) => void | Promise<void>;

function isPromiseLike(x: unknown): x is PromiseLike<unknown> {
	return x != null && typeof x === 'object' && 'then' in x && typeof x.then === 'function';
}

type Args<T> = T extends Listener ? Parameters<T> : [T];

type ListenerItem = { eventName: PropertyKey; fn: Function };

type ErrorListener = Listener<{ listener: ListenerItem; reason: unknown }>;

export class AsyncEmitter<T = any> {
	private static readonly Error: unique symbol = Symbol.for('AsyncEmitter.Error');
	static onUnhandledError: ErrorListener = function onUnhandledError(error) {
		console.error(`Error during [${String(error.listener.eventName)}] event.`, error.reason);
	};

	readonly #listeners = new Map<PropertyKey, ListenerItem[]>();

	onUnhandledError = AsyncEmitter.onUnhandledError;

	public on(eventName: typeof AsyncEmitter.Error, onError: ErrorListener): void;
	public on<K extends keyof T>(eventName: K, listener: (...args: Args<T[K]>) => void | Promise<void>): void;
	public on(eventName: PropertyKey, listener: (...args: any[]) => void | Promise<void>) {
		let found = this.#listeners.get(eventName);
		if (!found) {
			found = [];
			this.#listeners.set(eventName, found);
		}
		found.push({ eventName, fn: listener });
	}

	public onError(onError: ErrorListener) {
		return this.on(AsyncEmitter.Error, onError);
	}

	public emitAsync<K extends keyof T>(eventName: K, ...args: Args<T[K]>): Promise<void> {
		return this.#emitAsync(eventName, args);
	}

	//fast path for the common case of no errors.
	async #emitAsync(eventName: PropertyKey, args: any[]): Promise<void> {
		const listeners = this.#listeners.get(eventName);
		if (!listeners) return;

		const ps = new Array(listeners.length);
		let thenables = false;
		let i = 0;
		try {
			for (; i != listeners.length; ++i) {
				ps[i] = listeners[i].fn.apply(this, args);
				thenables ||= isPromiseLike(ps[i]);
			}
		} catch (err) {
			await this.#emitError(listeners[i], err);
			if (++i != listeners.length) thenables ||= await this.#emitAsyncSafe(listeners, args, i, ps);
		}

		if (thenables) await this.#handlePromises(listeners, ps);
	}

	async #emitError(listener: ListenerItem, err: unknown) {
		const error = { listener, reason: err };
		const listeners = this.#listeners.get(AsyncEmitter.Error);
		if (!listeners) return this.onUnhandledError(error);

		for (const { fn } of listeners) {
			try {
				await Promise.resolve(fn.call(this, error));
			} catch (error) {
				this.onUnhandledError({ listener: { eventName: AsyncEmitter.Error, fn }, reason: error });
			}
		}
	}

	async #handlePromises(listeners: readonly ListenerItem[], ps: any[]) {
		for (var i = 0; i != ps.length; ++i) {
			try {
				await Promise.resolve(ps[i]);
			} catch (err) {
				await this.#emitError(listeners[i], err);
			}
		}
	}

	async #emitAsyncSafe(
		listeners: readonly ListenerItem[],
		args: readonly any[],
		from: number,
		ps: any[],
	): Promise<boolean> {
		let thenables = false;
		for (var i = from; i != listeners.length; ++i) {
			try {
				ps[i] = listeners[i].fn.apply(this, args);
				thenables ||= isPromiseLike(ps[i]);
			} catch (err) {
				await this.#emitError(listeners[i], err);
			}
		}
		return thenables;
	}
}
