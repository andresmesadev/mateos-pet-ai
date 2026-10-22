jest.mock('../../contexts/services', () => ({ changePetServicePriceInTransaction: jest.fn() }));
const { changePetServicePriceInTransaction: changePrice } = require('../../contexts/services');
const { savePetGroomingDefaults: save } = require('../../services/appointment-pet-grooming-sync.service');
const { resolveAppointmentTotal } = require('../../services/domain/price-resolver.service');
const row = { tenantId: 'clinic-a', petId: 'pet-a', serviceId: 'grooming-a', serviceType: 'grooming' };
let tx;
beforeEach(()=>{jest.clearAllMocks();tx={$queryRaw:jest.fn(),pet:{updateMany:jest.fn().mockResolvedValue({count:1})},priceRule:{findFirst:jest.fn().mockResolvedValue({id:'rule'})}};});
test.each(['pet-a','pet-b'])('saves the service amount in the actual pet %s and its service agreement',async petId=>{
 const afterCommit=[];await save(tx,{...row,petId},{price:42000,canPrice:true,afterCommit});
 expect(tx.pet.updateMany).toHaveBeenCalledWith({where:{id:petId,tenantId:'clinic-a'},data:{defaultGroomingPrice:42000}});
 expect(changePrice).toHaveBeenCalledWith({serviceId:'grooming-a',tenantId:'clinic-a',target:{type:'pet',petId},newPrice:42000},{tx,afterCommit});
});
test.each(['round_trip','pickup','delivery'])('saves modality %s and preserves a free fee',async mode=>{
 await save(tx,row,{transport:{transportMode:mode,transportPrice:0},canPrice:true});
 expect(tx.pet.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{defaultGroomingTransportMode:mode,defaultGroomingTransportPrice:0,defaultGroomingWithTransportPrice:null}}));
 const result=resolveAppointmentTotal({pet:{defaultGroomingPrice:42000,defaultGroomingTransportMode:mode,defaultGroomingTransportPrice:18000},transportMode:mode});
 expect(result.transportReferencePrice).toBe(18000);
});
test('reception cannot overwrite habitual money while changing arrival mode',async()=>{
 await save(tx,row,{transport:{transportMode:'pickup',transportPrice:null},canPrice:false});
 expect(tx.pet.updateMany.mock.calls[0][0].data).toEqual({defaultGroomingTransportMode:'pickup'});
});
test('a shared ride does not turn the habitual fee into zero',async()=>{
 await save(tx,row,{transport:{transportMode:'shared',transportPrice:0},canPrice:true});expect(tx.pet.updateMany).not.toHaveBeenCalled();
});
test('clearing a manual visit override does not erase a habitual agreement',async()=>{
 await save(tx,row,{price:null,canPrice:true});expect(tx.pet.updateMany).not.toHaveBeenCalled();expect(changePrice).not.toHaveBeenCalled();
});
test('habitual edits do not create a new service override that would mask later dossier edits',async()=>{
 tx.priceRule.findFirst.mockResolvedValue(null);await save(tx,row,{price:42000,canPrice:true});expect(changePrice).not.toHaveBeenCalled();expect(tx.pet.updateMany).toHaveBeenCalled();
});
test('veterinary service and foreign pet failures never update a grooming default',async()=>{
 await save(tx,{...row,serviceType:'vet'},{price:60000,canPrice:true});expect(tx.pet.updateMany).not.toHaveBeenCalled();
 tx.pet.updateMany.mockResolvedValue({count:0});await expect(save(tx,row,{transport:{transportMode:'none'},canPrice:false})).rejects.toMatchObject({status:409});
});
test('a failure updating the agreement prevents the pet write',async()=>{
 changePrice.mockRejectedValueOnce(new Error('db failure'));await expect(save(tx,row,{price:42000,canPrice:true})).rejects.toThrow('db failure');expect(tx.pet.updateMany).not.toHaveBeenCalled();
});
