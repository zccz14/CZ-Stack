import { ContractClientError, createContractClient, type HealthError } from "@cz-stack/contract";
import { Command, Flags } from "@oclif/core";

export type CliHealthSuccess = {
  ok: true;
  data: {
    status: "ok";
  };
};

export type CliHealthFailure = {
  ok: false;
  error: HealthError;
};

const fallbackError: HealthError = {
  code: "UNAVAILABLE",
  message: "unexpected error",
};

export default class HealthCommand extends Command {
  static override description = "Check API health via the shared contract client";

  static override flags = {
    "base-url": Flags.string({
      description: "API base URL",
      required: true,
    }),
  };

  public async run(): Promise<CliHealthSuccess> {
    const { flags } = await this.parse(HealthCommand);
    const client = createContractClient({ baseUrl: flags["base-url"] });

    try {
      const response = await client.getHealth();
      const result: CliHealthSuccess = {
        ok: true,
        data: response,
      };

      this.log(JSON.stringify(result));

      return result;
    } catch (error) {
      const failure: CliHealthFailure = {
        ok: false,
        error: error instanceof ContractClientError ? error.error : fallbackError,
      };

      process.stderr.write(`${JSON.stringify(failure)}\n`);
      this.exit(1);
    }
  }
}
