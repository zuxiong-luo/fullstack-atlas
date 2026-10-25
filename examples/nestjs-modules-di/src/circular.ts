import 'reflect-metadata';
import {Inject,Injectable,forwardRef} from '@nestjs/common';import {Test} from '@nestjs/testing';
@Injectable()
export class Left {
 // The interface-like object type avoids an eager JS metadata reference to Right before its declaration.
 constructor(@Inject(forwardRef(()=>Right)) readonly right:object){}
}
@Injectable()
export class Right {constructor(@Inject(forwardRef(()=>Left)) readonly left:object){}}
export async function circularExample(){return Test.createTestingModule({providers:[Left,Right]}).compile();}
