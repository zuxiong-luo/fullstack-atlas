import type {Article} from '../../articleTypes';
import lifecycle from './nestjs-request-lifecycle';
import modules from './nestjs-modules-di';
import data from './nestjs-typeorm-integration';
import authorization from './nestjs-validation-authorization';
import reliability from './nestjs-reliability';
import delivery from './nestjs-testing-delivery';
export const nestExpansionArticles:Article[] = [lifecycle,modules,data,authorization,reliability,delivery];
