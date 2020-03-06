import { join } from 'path';
import { ContractInfo } from '../src/abi/contract';
import { AbiRepository } from '../src/abi/repo';
import { BlockWatcher } from '../src/blockwatcher';
import { Checkpoint } from '../src/checkpoint';
import { BatchedEthereumClient } from '../src/eth/client';
import { HttpTransport } from '../src/eth/http';
import { withRecorder } from '../src/eth/recorder';
import { suppressDebugLogging } from '../src/utils/debug';
import LRUCache from '../src/utils/lru';
import { TestOutput } from './testoutput';

let logHandle: any;
beforeEach(() => {
    logHandle = suppressDebugLogging();
});
afterEach(() => {
    logHandle.restore();
});

test('blockwatcher', async () => {
    await withRecorder(
        new HttpTransport('https://dai.poa.network', {}),
        {
            name: 'xdai-blockwatcher',
            storageDir: join(__dirname, './fixtures/recorded'),
            replay: true,
        },
        async transport => {
            const ethClient = new BatchedEthereumClient(transport, { maxBatchSize: 100, maxBatchTime: 0 });
            const abiRepo = new AbiRepository({
                decodeAnonymous: true,
                fingerprintContracts: true,
                abiFileExtension: '.json',
                directory: join(__dirname, './abis'),
                searchRecursive: true,
            });
            await abiRepo.initialize();
            const checkpoints = new Checkpoint({
                initialBlockNumber: 123,
                path: join(__dirname, '../tmp/tmpcheckpoint.json'),
                saveInterval: 10000,
            });
            const output = new TestOutput();
            const contractInfoCache = new LRUCache<string, Promise<ContractInfo>>({ maxSize: 100 });
            const blockWatcher = new BlockWatcher({
                abiRepo,
                checkpoints,
                chunkSize: 1,
                ethClient,
                maxParallelChunks: 1,
                output,
                pollInterval: 1,
                startAt: 'latest',
                chunkQueueMaxSize: 10,
                contractInfoCache,
                waitAfterFailure: 1,
            });

            await blockWatcher.processChunk({ from: 6442472, to: 6442482 });

            expect(output.messages).toMatchSnapshot();
        }
    );
}, 15000);
