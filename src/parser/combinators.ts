import { Either } from "./either"
import { Parser } from "./parser"

export const string = (str: string): Parser<string> => {
	return new Parser(
		(state) => {
			if (str === "" || state.input.startsWith(str)) {
				return Parser.succeed(str, state, str)
			}

			const errorMessage =
				`Expected ${str}, ` + `but found ${state.input.slice(0, 10)}...`

			return Parser.error(errorMessage, [str], state.pos)
		},
		{ name: str },
	)
}

export const char = <T extends string>(ch: T): Parser<T> => {
	return new Parser(
		(state) => {
			if (ch.length !== 1) {
				return Parser.error(
					"char parser expects a single character",
					[ch],
					state.pos,
				)
			}
			if (state.input[0] === ch) {
				return Parser.succeed(ch, state, ch)
			}

			const errorMessage = `Expected ${ch} but found ${state.input.at(0)}.`

			return Parser.error(errorMessage, [ch], state.pos)
		},
		{ name: ch },
	)
}

export const alphabet = new Parser(
	(state) => {
		if (state.input.length === 0) {
			return Parser.error("Unexpected end of input", [], state.pos)
		}
		const first = state.input[0]
		if (first && /^[a-zA-Z]$/.test(first)) {
			return Parser.succeed(first, state, first)
		}
		return Parser.error(
			`Expected alphabetic character, but got '${first}'`,
			[],
			state.pos,
		)
	},
	{ name: "alphabet" },
)

export const digit = new Parser(
	(state) => {
		if (state.input.length === 0) {
			return Parser.error("Unexpected end of input", [], state.pos)
		}
		const first = state.input[0]
		if (first && /^[0-9]$/.test(first)) {
			return Parser.succeed(first, state, first)
		}
		return Parser.error(`Expected digit, but got '${first}'`, [], state.pos)
	},
	{ name: "digit" },
)

export function sepBy<S, T>(
	sepParser: Parser<S>,
	parser: Parser<T>,
): Parser<T[]> {
	return Parser.gen(function* () {
		const acc: Array<T> = []
		const firstResult = yield* optional(parser)
		if (firstResult) {
			acc.push(firstResult)
			while (true) {
				const sepResult = yield* optional(sepParser)
				if (!sepResult) {
					return acc
				}
				const result = yield* parser
				acc.push(result)
			}
		}
		return acc
	}) as Parser<T[]>
}

export function between<T>(
	start: string,
	end: string,
	parser: Parser<T>,
): Parser<T> {
	return Parser.gen(function* () {
		yield* string(start)
		const result = yield* parser
		yield* string(end)
		return result
	})
}

function many_<T>(count: number) {
	return (parser: Parser<T>): Parser<T[]> => {
		return Parser.gen(function* () {
			const acc: T[] = []
			while (true) {
				const result = yield* optional(parser)
				if (!result) {
					if (acc.length >= count) {
						return acc
					}
					return yield* Parser.fail(
						`Expected at least ${count} occurrences, but only found ${acc.length}`,
					)
				}
				acc.push(result)
			}
		}) as Parser<T[]>
	}
}

export const many = <T>(parser: Parser<T>) => many_<T>(0)(parser)
export const many1 = <T>(parser: Parser<T>) => many_<T>(1)(parser)
export const manyN = <T>(parser: Parser<T>, n: number) => many_<T>(n)(parser)

export function skipMany_<T>(count: number) {
	return (parser: Parser<T>): Parser<undefined> => {
		return Parser.gen(function* () {
			for (let i = 0; i < count; i++) {
				const result = yield* optional(parser)
				if (!result) {
					return yield* Parser.fail(
						`Expected at least ${count} occurrences, but only found ${i}`,
					)
				}
			}
			return undefined
		}) as Parser<undefined>
	}
}

export const skipMany = <T>(parser: Parser<T>) => skipMany_<T>(0)(parser)
export const skipMany1 = <T>(parser: Parser<T>) => skipMany_<T>(1)(parser)
export const skipManyN = <T>(parser: Parser<T>, n: number) =>
	skipMany_<T>(n)(parser)

export function skipUntil<T>(parser: Parser<T>): Parser<undefined> {
	return Parser.gen(function* () {
		while (true) {
			const result = yield* optional(parser)
			if (!result) {
				return undefined
			}
		}
	})
}

// export function skipSpaces(): Parser<undefined> {
// 	return new Parser((state) => {
// 		const trimmedInput = state.input.trim();
// 		return Parser.succeed(undefined, state, trimmedInput);
// 	});
// }
export const skipSpaces = new Parser(
	(state) => {
		const trimmedInput = state.input.trim()
		return Parser.succeed(undefined, state, trimmedInput)
	},
	{ name: "skipSpaces" },
)

export function or<T>(...parsers: Array<Parser<T>>): Parser<T> {
	return Parser.gen(function* () {
		for (const parser of parsers) {
			const result = yield* optional(parser)
			if (result) {
				return result
			}
		}

		return yield* Parser.fail(
			`None of the ${parsers.length} choices could be satisfied`,
			parsers
				.filter((x) => x.options?.name != null)
				.map((p) => p.options?.name ?? ""),
		)
	}) as Parser<T>
}

export function optional<T>(parser: Parser<T>): Parser<T | undefined> {
	return new Parser((state) => {
		const result = parser.run(state.input)
		if (Either.isLeft(result)) {
			return Parser.succeed(undefined, state)
		}
		return result
	})
}

export function sequence<T>(parsers: Parser<T>[]): Parser<T> {
	return new Parser((state) => {
		const results: T[] = []
		let currentState = state

		for (const parser of parsers) {
			const result = parser._run(currentState)
			if (Either.isLeft(result)) {
				return result
			}
			const [value, newState] = result.right
			results.push(value)
			currentState = newState
		}

		return Either.right([results.at(-1), currentState]) as any
	})
}

export const chain = <T, U>(
	parser: Parser<T>,
	fn: (value: T) => Parser<U>,
): Parser<U> => {
	return new Parser((state) => {
		const result = parser._run(state)
		if (Either.isLeft(result)) {
			return result
		}
		const [value, newState] = result.right
		return fn(value)._run(newState)
	})
}

export const regex = (re: RegExp): Parser<string> => {
	return new Parser(
		(state) => {
			const match = re.exec(state.input)
			if (match && match.index === 0) {
				const value = match[0]
				return Parser.succeed(value, state, value)
			}
			return Parser.error(
				`Expected ${re} but found ${state.input.slice(0, 10)}...`,
				[re.toString()],
				state.pos,
			)
		},
		{ name: re.toString() },
	)
}