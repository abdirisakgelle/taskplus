import * as React from "react";
import { Component } from "react";
import { Grid as Gridjs, Config } from "gridjs";
declare class Grid extends Component<Partial<Config>, any> {
    private wrapper;
    private readonly instance;
    constructor(props: any);
    getInstance(): Gridjs;
    componentDidMount(): void;
    componentDidUpdate(): void;
    render(): React.ReactElement;
}
export default Grid;
