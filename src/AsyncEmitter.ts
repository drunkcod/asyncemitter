type Listener<TArgs = any> = TArgs extends []
	? (...args: TArgs) => void | Promise<void>
	: (arg: TArgs) => void | Promise<void>;

function isPromiseLike(x: unknown): x is PromiseLike<unknown> {
	return x != null && typeof x === 'object' && 'then' in x && typeof x.then === 'function';
}

type Args<T> = T extends Listener ? Parameters<T> : [T];

export class AsyncEmitter<T = any> {
	readonly #listeners = new Map<PropertyKey, Function[]>();

	public on(eventName: 'error', onError: Listener<unknown>): void;
	public on<K extends keyof T>(eventName: K, listener: (...args: Args<T[K]>) => void | Promise<void>): void;
	public on(eventName: PropertyKey, listener: (...args: any[]) => void | Promise<void>) {
		let found = this.#listeners.get(eventName);
		if (!found) {
			found = [];
			this.#listeners.set(eventName, found);
		}
		found.push(listener);
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
				ps[i] = listeners[i].apply(this, args);
				thenables ||= isPromiseLike(ps[i]);
			}
		} catch (err) {
			await this.#emitError(err);
			if (++i != listeners.length) thenables ||= await this.#emitAsyncSafe(args, i, listeners, ps);
		}

		if (thenables) await this.#handlePromises(ps);
	}

	#emitError(err: unknown) {
		return this.#emitAsync('error', [err]);
	}

	async #handlePromises(ps: any[]) {
		for (var x of ps) {
			try {
				await Promise.resolve(x);
			} catch (err) {
				await this.#emitError(err);
			}
		}
	}

	async #emitAsyncSafe(args: any[], from: number, listeners: Function[], ps: any[]): Promise<boolean> {
		let thenables = false;
		for (var i = from; i != listeners.length; ++i) {
			try {
				ps[i] = listeners[i].apply(this, args);
				thenables ||= isPromiseLike(ps[i]);
			} catch (err) {
				await this.#emitError(err);
			}
		}
		return thenables;
	}
}
