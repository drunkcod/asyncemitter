import { Suite, BenchNode } from 'bench-node';
import { AsyncEmitter } from './AsyncEmitter.js';

const suite = new Suite();

type BenchFn =
	| (() => void | Promise<void>)
	| ((timer: { start(): void; end(count: number): void; count: number }) => void | Promise<void>);

function add(name: string, x: BenchFn) {
	suite.add(name, x as BenchNode.BenchmarkFunction);
}

add('emit sync listeners', async (t) => {
	const emitter = new AsyncEmitter();
	emitter.on('hello', () => {});
	t.start();
	for (var i = 0; i !== t.count; ++i) await emitter.emitAsync('hello');

	t.end(t.count);
});

add('emit async listeners', async (t) => {
	const emitter = new AsyncEmitter();
	emitter.on('hello', async () => {});
	t.start();
	for (var i = 0; i !== t.count; ++i) await emitter.emitAsync('hello');

	t.end(t.count);
});

function functionToCall(...args: number[]) {
	// a simple function that does some work
	return args.reduce((a, b) => a + b, 0);
}

const args = [1, 2, 3, 4, 5];

add('function.apply', (t) => {
	t.start();
	for (var i = 0; i !== t.count; ++i) {
		functionToCall.apply(null, args);
	}
	t.end(t.count);
});

add('spread operator', (t) => {
	t.start();
	for (var i = 0; i !== t.count; ++i) {
		functionToCall(...args);
	}
	t.end(t.count);
});

suite.run();
