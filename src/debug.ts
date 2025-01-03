import { Either } from "./either"
import { Parser, type ParserResult } from "./parser"
import { type ParserState, State } from "./state"

/**
 * Creates a debug output for a parser's current state and result
 */
export function debugState(
	label: string,
	state: ParserState,
	result: ParserResult<any>,
	options: {
		inputPreviewLength?: number
		separator?: string
	} = {},
) {
	const {
		inputPreviewLength = 20,
		separator = "=".repeat(40),
	} = options

	console.log(`\n=== ${label} ===`)
	console.log("Position:", State.printPosition(state))
	console.log(
		"Input:",
		JSON.stringify(
			state.remaining.slice(0, inputPreviewLength) +
				(state.remaining.length > inputPreviewLength
					? "..."
					: ""),
		),
	)
	console.log(
		"Result:",
		Either.isRight(result)
			? `Success: ${JSON.stringify(result.right[0])}`
			: `Error: ${result.left.message}`,
	)
	console.log(separator)
}

/**
 * Adds debug output to a parser
 */
export function debug<T>(
	parser: Parser<T>,
	label: string,
): Parser<T> {
	return parser.tap((state, result) =>
		debugState(label, state, result),
	)
}

/**
 * Creates a parser that logs its input state and continues
 */
export function trace(label: string): Parser<void> {
	return new Parser((state) => {
		console.log(`\n[TRACE] ${label}`)
		console.log("Position:", State.printPosition(state))
		console.log(
			"Remaining:",
			JSON.stringify(state.remaining),
		)
		return Parser.succeed(undefined, state)
	})
}

/**
 * Adds breakpoints to a parser for step-by-step debugging
 */
export function breakpoint<T>(
	parser: Parser<T>,
	label: string,
): Parser<T> {
	return parser.tap((state, result) => {
		debugState(label, state, result)
		// eslint-disable-next-line no-debugger
		debugger
	})
}

/**
 * Times how long a parser takes to run
 */
export function benchmark<T>(
	parser: Parser<T>,
	label: string,
): Parser<T> {
	return new Parser((state) => {
		const start = performance.now()
		const result = parser.parse(state)
		const end = performance.now()
		console.log(
			`\n[BENCHMARK] ${label}: ${(end - start).toFixed(2)}ms`,
		)
		return result
	})
}
