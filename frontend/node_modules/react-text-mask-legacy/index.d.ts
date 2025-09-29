// Type definitions for react-text-mask-legacy 5.5
// Project: https://github.com/Gruven/text-mask/tree/master/react
// Definitions by: Guilherme Hübner <https://github.com/guilhermehubner>
//                 Deividi Cavarzan <https://github.com/cavarzan>
//                 Artem Lyubchuk <https://github.com/needpower>
//                 Pavel <https://github.com/p-piseckiy>
//                 Alexander Kupriyanov <https://github.com/Gruven>
// Minimum TypeScript Version: 3.9

import * as React from 'react';

export interface PipeConfig {
  placeholder: string;
  placeholderChar: string;
  currentCaretPosition: number;
  keepCharPositions: boolean;
  rawValue: string;
  guide: boolean | undefined;
  previousConformedValue: string | undefined;
}

export type MaskArray = Array<string | RegExp>;
export type Mask = MaskArray | ((value: string) => MaskArray | false) | false;
export type Pipe = (
  conformedValue: string,
  config: PipeConfig,
) => false | string | { value: string; indexesOfPipedChars: number[] };

export type ConformToMaskConfig = Partial<Omit<PipeConfig, 'rawValue'>>;

export interface MaskedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    mask: Mask | {
      mask: Mask,
      pipe: Pipe,
    };

    guide?: boolean;

    placeholderChar?: string;

    keepCharPositions?: boolean;

    pipe?: Pipe;

    showMask?: boolean;

    render?: (
        ref: (inputElement: HTMLElement) => void,
        props: {
            onChange: (event: React.ChangeEvent<HTMLElement>) => void;
            onBlur: (event: React.FocusEvent<HTMLElement>) => void;
            defaultValue: string | undefined;
        },
    ) => React.ReactNode;
}

export interface ConformToMaskResult {
    conformedValue: string;
    meta: {
        someCharsRejected: boolean;
    };
}

export default class MaskedInput extends React.Component<MaskedInputProps, any> {
    inputElement: HTMLElement;
}

export function conformToMask(
    text: string,
    mask: Mask,
    config?: ConformToMaskConfig,
): ConformToMaskResult;
