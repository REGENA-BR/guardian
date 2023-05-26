import { PolicyEngine } from '@helpers/policy-engine';
import { Logger } from '@guardian/common';
import { Controller, Post, Req, Response } from '@nestjs/common';

@Controller('external')
export class ExternalApi {
    @Post('/')
    async receiveExternalData(@Req() req, @Response() res): Promise<any> {
        const engineService = new PolicyEngine();

        try {
            return res.send(await engineService.receiveExternalData(req.body));
        } catch (error) {
            new Logger().error(error, ['API_GATEWAY']);
            throw error;
        }
    }
}
