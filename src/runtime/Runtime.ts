import { IHighlightSyntax } from "../core/syntax/IHighlightSyntax";
import { HighlightService } from "../services/HighlightService";
import { DecorationManager } from "../services/DecorationManager";

/**
 * Mutable holder for the dependencies that depend on user configuration.
 *
 * Commands reference the Runtime (not the individual services) so that, when
 * settings change, we can rebuild these fields in place and every command
 * immediately picks up the new color without re-registration.
 */
export class Runtime {
  constructor(
    public syntax: IHighlightSyntax,
    public service: HighlightService,
    public decorations: DecorationManager,
  ) {}
}
