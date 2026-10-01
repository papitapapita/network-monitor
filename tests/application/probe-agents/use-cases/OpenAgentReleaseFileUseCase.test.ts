import { Readable } from 'stream';
import {
  AGENT_RELEASE_FILE_NOT_FOUND,
  OpenAgentReleaseFileUseCase
} from '../../../../src/application/probe-agents/use-cases';
import { FakeReleaseCatalog, makeLogger } from '../fixtures';

describe('OpenAgentReleaseFileUseCase', () => {
  let releases: FakeReleaseCatalog;
  let useCase: OpenAgentReleaseFileUseCase;

  beforeEach(() => {
    releases = new FakeReleaseCatalog();
    useCase = new OpenAgentReleaseFileUseCase(releases, makeLogger());
  });

  it('[AGT-083] opens a binary a release lists', async () => {
    const download = { bytes: 3, stream: Readable.from(['abc']) };
    releases.files.set('nms-agent-0.2.1-linux-x64.gz', download);

    const result = await useCase.execute({
      fileName: 'nms-agent-0.2.1-linux-x64.gz'
    });

    expect(result.value).toBe(download);
  });

  it('[AGT-083] answers not found for any other name', async () => {
    const result = await useCase.execute({ fileName: 'other.gz' });

    expect(result.error).toBe(AGENT_RELEASE_FILE_NOT_FOUND);
  });

  it('fails when the releases cannot be read', async () => {
    releases.failWith = 'folder gone';

    const result = await useCase.execute({ fileName: 'x.gz' });

    expect(result.isFailure).toBe(true);
    expect(result.error).not.toBe(AGENT_RELEASE_FILE_NOT_FOUND);
  });
});
